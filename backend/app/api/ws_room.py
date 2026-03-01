import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from backend.app.api.rooms import get_current_room_context
from backend.app.auth.jwt import JwtError
from backend.app.db.connection import DATA_DIR, db_transaction
from backend.app.db import repository as db
from backend.app.db.schemas import RoomSchema
from backend.app.services.ai_guess_log_buffer import enqueue_ai_guess_log
from backend.app.services.game_service import check_win_combined, check_win_for_word, contains_taboo, contains_target_word, run_room_game, transcribe_player_speech


logger = logging.getLogger(__name__)

router = APIRouter()


@dataclass
class RoomConnection:
    websocket: WebSocket
    user_id: str
    name: str
    role: str


@dataclass
class RoomGameState:
    transcript: str = ""
    target_word: str = ""
    winner_type: str | None = None  # "human" | "AI"
    winner_user_id: str | None = None
    winner_display_name: str | None = None
    winning_guess: str | None = None
    started_at: datetime | None = None
    # Id of the current room_game row (one per round); set at game start, cleared on NEW_GAME.
    current_room_game_id: int | None = None
    # Structured guess lists for the AI prompt (transcript + LLM guesses + other players' guesses).
    # Target word and taboo words are never sent to the LLM.
    llm_guesses: list[str] = field(default_factory=list)
    other_guesses: list[dict[str, str]] = field(default_factory=list)  # [{"display_name": str, "guess": str}, ...]
    # Rolling list of the last 3 guesses (any source) for multi-word target matching.
    recent_guesses: list[str] = field(default_factory=list)


_room_connections: Dict[str, List[RoomConnection]] = {}
_room_states: Dict[str, RoomGameState] = {}
_room_locks: Dict[str, asyncio.Lock] = {}


def _get_room_state(room_id: str) -> RoomGameState:
    if room_id not in _room_states:
        _room_states[room_id] = RoomGameState()
    return _room_states[room_id]


def _get_room_lock(room_id: str) -> asyncio.Lock:
    if room_id not in _room_locks:
        _room_locks[room_id] = asyncio.Lock()
    return _room_locks[room_id]


def _write_audio_chunk(path: str, chunk: bytes) -> None:
    try:
        with open(path, "ab") as f:
            f.write(chunk)
    except Exception as exc:
        logger.error("Failed to write audio chunk to %s: %s", path, exc)


def _add_connection(room_id: str, conn: RoomConnection) -> None:
    _room_connections.setdefault(room_id, []).append(conn)


def _remove_connection(room_id: str, websocket: WebSocket) -> None:
    conns = _room_connections.get(room_id)
    if not conns:
        return
    _room_connections[room_id] = [c for c in conns if c.websocket is not websocket]
    if not _room_connections[room_id]:
        _room_connections.pop(room_id, None)


async def _broadcast(room_id: str, payload: Dict[str, Any]) -> None:
    conns = list(_room_connections.get(room_id, []))
    if not conns:
        return
    to_remove: List[WebSocket] = []
    for conn in conns:
        try:
            await conn.websocket.send_json(payload)
        except Exception as exc:  # pragma: no cover - best-effort broadcast
            logger.warning("Failed to send to websocket in room %s: %s", room_id, exc)
            to_remove.append(conn.websocket)
    for ws in to_remove:
        _remove_connection(room_id, ws)


def _get_player_list(room_id: str) -> List[Dict[str, str]]:
    """Return list of connected human players (role=player) for this room."""
    conns = _room_connections.get(room_id, [])
    return [{"name": c.name} for c in conns if c.role == "player"]


async def _broadcast_players(room_id: str) -> None:
    """Send each connection the current player list and their 1-based player number (if they are a player)."""
    conns = list(_room_connections.get(room_id, []))
    if not conns:
        return
    players = _get_player_list(room_id)
    # Build 1-based index for each player connection (order = connection order in room).
    player_index_by_conn: Dict[WebSocket, int] = {}
    idx = 1
    for c in conns:
        if c.role == "player":
            player_index_by_conn[c.websocket] = idx
            idx += 1
    to_remove: List[WebSocket] = []
    for conn in conns:
        payload: Dict[str, Any] = {"type": "PLAYERS_UPDATE", "players": players}
        if conn.websocket in player_index_by_conn:
            payload["yourPlayerNumber"] = player_index_by_conn[conn.websocket]
        try:
            await conn.websocket.send_json(payload)
        except Exception as exc:  # pragma: no cover - best-effort
            logger.warning("Failed to send PLAYERS_UPDATE in room %s: %s", room_id, exc)
            to_remove.append(conn.websocket)
    for ws in to_remove:
        _remove_connection(room_id, ws)


async def _process_guess(
    room_id: str,
    *,
    source: str,
    guess_text: str,
    transcript: str,
    user_id: str | None,
    display_name: str,
) -> None:
    """
    Common handler for both human and AI guesses.

    - Persists every guess.
    - Determines the first winning guess (human or AI) using a per-room lock.
    - Updates the room outcome and broadcasts GAME_OVER once.
    """
    lock = _get_room_lock(room_id)
    async with lock:
        # Guard: if the game was reset by NEW_GAME while this guess was in flight,
        # started_at will be None — discard silently to prevent a spurious GAME_OVER.
        state = _get_room_state(room_id)
        if state.started_at is None:
            logger.debug("[GUESS] Dropping stale guess '%s' (room %s reset by NEW_GAME)", guess_text, room_id)
            return

        target_word = state.target_word
        is_correct = check_win_for_word(guess_text, target_word)
        # For multi-word targets (2-3 words), also check if the last 2-3 guesses
        # combined spell out the target (e.g. "Warren" + "Buffet" -> "Warren Buffet").
        if not is_correct:
            candidate_history = state.recent_guesses + [guess_text]
            is_correct = check_win_combined(candidate_history, target_word)

        already_has_winner = state.winner_type is not None

        # Persist guess. Only the first winning guess is marked is_win=True.
        is_win_for_row = bool(is_correct and not already_has_winner)

        # Maintain rolling recent_guesses window (last 3, all sources).
        state.recent_guesses = (state.recent_guesses + [guess_text])[-3:]

        # Keep the AI's view of other players' guesses up-to-date so it doesn't repeat them.
        if source != "AI" and not is_correct and not already_has_winner:
            state.other_guesses.append({
                "display_name": display_name,
                "guess": guess_text,
            })

        if is_correct and not already_has_winner:
            # This is the first winning guess.
            winner_type = "AI" if source == "AI" else "human"
            state.winner_type = winner_type
            state.winner_user_id = user_id
            state.winner_display_name = display_name
            state.winning_guess = guess_text

            # Capture state for out-of-lock execution
            final_winner_type = winner_type
            final_transcript = state.transcript or transcript
            final_room_game_id = state.current_room_game_id
            started_at = state.started_at
        else:
            final_winner_type = None
            final_transcript = None
            final_room_game_id = None
            started_at = state.started_at

    # --- Execute slow operations outside the lock ---
    async with db_transaction() as session:
        await db.insert_guess(
            session,
            guess_text=guess_text,
            is_win=is_win_for_row,
            user_id=user_id,
            display_name=display_name,
            source=source,
            room_id=room_id,
        )

        if final_winner_type is not None:
            await db.update_room_outcome(
                session,
                room_id=room_id,
                status=db.ROOM_STATUS_WON,
                time_remaining_seconds=None,
                final_transcript=final_transcript,
                winning_guess=guess_text,
                winner_type=final_winner_type,
                winner_user_id=user_id,
                winner_display_name=display_name,
            )
            if final_room_game_id is not None:
                ended_at = datetime.now(timezone.utc)
                await db.update_room_game_outcome(
                    session,
                    final_room_game_id,
                    ended_at=ended_at,
                    winner_type=final_winner_type,
                    winning_guess=guess_text,
                    final_transcript=final_transcript,
                )

    event_type = "AI_GUESS" if source == "AI" else "HUMAN_GUESS"
    await _broadcast(
        room_id,
        {
            "type": event_type,
            "guess": guess_text,
            "userName": display_name,
            "isWin": is_win_for_row,
        },
    )

    if final_winner_type is not None:
        # Broadcast GAME_OVER with winner metadata (outside session scope).
        ended_at = datetime.now(timezone.utc)
        duration_seconds: int | None = None
        if started_at:
            duration_seconds = int((ended_at - started_at).total_seconds())

        await _broadcast(
            room_id,
            {
                "type": "GAME_OVER",
                "winnerType": final_winner_type,
                "winnerDisplayName": display_name,
                "winningGuess": guess_text,
                "durationSeconds": duration_seconds,
                "targetWord": target_word,
            },
        )


@router.websocket("/room/{room_id}")
async def websocket_room_endpoint(websocket: WebSocket, room_id: str) -> None:
    """
    Multi-participant room WebSocket.

    - GM: streams audio + initial config; drives Mistral transcription and AI guesses.
    - Players: see transcript, submit text guesses.
    """
    await websocket.accept()
    raw_token = websocket.query_params.get("token")

    try:
        async with db_transaction() as session:
            ctx = await get_current_room_context(
                room_id=room_id, token=raw_token, session=session
            )
    except JwtError as exc:
        logger.warning("JWT error for room %s: %s", room_id, exc)
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
        return
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("Error validating room context: %s", exc, exc_info=True)
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR, reason="Internal error")
        return

    user_id: str = ctx["user_id"]
    name: str = ctx["name"]
    role: str = ctx["role"]
    room: RoomSchema = ctx["room"]
    room_id = room.id  # use canonical (lowercase) id for in-memory state

    logger.info("WebSocket connected to room %s as %s (%s)", room_id, name, role)

    _add_connection(room_id, RoomConnection(websocket=websocket, user_id=user_id, name=name, role=role))
    await _broadcast_players(room_id)

    state = _get_room_state(room_id)
    if not state.target_word and room.target_word:
        state.target_word = room.target_word

    # If the game is already in progress, tell this client so they can enable the guess form.
    if state.started_at is not None and state.winner_type is None:
        try:
            await websocket.send_json({"type": "GAME_STARTED"})
        except Exception as exc:  # pragma: no cover
            logger.warning("Failed to send GAME_STARTED to late joiner in room %s: %s", room_id, exc)

    # GM-specific setup: audio queue + game loop.
    audio_queue: asyncio.Queue[bytes | None] | None = None
    game_task: asyncio.Task | None = None
    game_task_ref: List[asyncio.Task | None] = [None]
    audio_buffer = bytearray()
    audio_file_path: str | None = None

    # Player-specific: per-recording audio queue + transcription task.
    player_audio_queue_ref: List[asyncio.Queue[bytes | None] | None] = [None]
    player_task_ref: List[asyncio.Task | None] = [None]
    gm_audio_chunks = 0
    gm_audio_bytes = 0
    player_audio_chunks = 0
    player_audio_bytes = 0
    player_audio_drop_count = 0

    if role == "gm":
        audio_queue = asyncio.Queue()

        async def handle_taboo_violation(
            rid: str,
            task_ref: List[asyncio.Task | None],
        ) -> None:
            lock = _get_room_lock(rid)
            async with lock:
                st = _get_room_state(rid)
                if st.winner_type is not None:
                    return
                st.winner_type = "gm_lost"
                async with db_transaction() as session:
                    await db.update_room_outcome(
                        session,
                        room_id=rid,
                        status=db.ROOM_STATUS_LOST,
                        time_remaining_seconds=None,
                        final_transcript=st.transcript,
                        winning_guess=None,
                        winner_type="gm_lost",
                        winner_user_id=None,
                        winner_display_name=None,
                    )
                await _broadcast(
                    rid,
                    {
                        "type": "GAME_OVER",
                        "winnerType": "gm_lost",
                        "tabooViolation": True,
                        "targetWord": getattr(room, "target_word", ""),
                    },
                )
                if task_ref[0] is not None:
                    task_ref[0].cancel()

        async def on_transcript_update(transcript: str) -> None:
            state.transcript = transcript
            await _broadcast(
                room_id,
                {
                    "type": "TRANSCRIPT_UPDATE",
                    "transcript": transcript,
                },
            )
            if state.winner_type is not None:
                return
            taboo_words = config.get("taboo_words") or []
            target_word = config.get("target_word") or ""
            if contains_taboo(transcript, taboo_words) or contains_target_word(transcript, target_word):
                asyncio.create_task(handle_taboo_violation(room_id, game_task_ref))

        async def on_ai_guess(
            guess: str,
            transcript: str,
            *,
            prompt_input: str = "",
            full_prompt: str | None = None,
            ground_truth: str = "",
        ) -> None:
            if state.current_room_game_id is not None and prompt_input:
                enqueue_ai_guess_log(
                    state.current_room_game_id,
                    prompt_input=prompt_input,
                    llm_output=guess,
                    ground_truth=ground_truth,
                    full_prompt=full_prompt,
                )
            await _process_guess(
                room_id,
                source="AI",
                guess_text=guess,
                transcript=transcript,
                user_id=None,
                display_name="AI",
            )

        async def start_game_loop(config: dict[str, Any]) -> None:
            # Mark room as started (if not already).
            if not state.started_at:
                state.started_at = datetime.now(timezone.utc)
                async with db_transaction() as session:
                    await db.update_room_on_start(session, room_id)
            assert audio_queue is not None
            await run_room_game(
                config=config,
                audio_queue=audio_queue,
                on_transcript_update=on_transcript_update,
                on_ai_guess=on_ai_guess,
                llm_guesses=state.llm_guesses,
                other_guesses=state.other_guesses,
            )

    async def _run_player_transcription(
        pq: asyncio.Queue[bytes | None],
    ) -> None:
        """Transcribe one voice recording from a player and submit chunked guesses."""
        try:
            logger.info("[WS_ROOM] Player transcription started room=%s player=%s", room_id, name)

            loop = asyncio.get_running_loop()
            silence_seconds = 0.4
            check_interval_seconds = 0.1
            max_guesses_per_recording = 20

            current_transcript = ""
            last_emitted_word_index = 0
            last_activity_time = loop.time()
            total_guesses = 0
            seen_guesses: set[str] = set()
            last_submitted_guess: str | None = None
            done = False

            async def _on_delta(partial: str) -> None:
                nonlocal current_transcript, last_activity_time
                current_transcript = partial or ""
                last_activity_time = loop.time()
                try:
                    await websocket.send_json({"type": "VOICE_TRANSCRIPT", "transcript": current_transcript})
                except Exception:
                    # Best-effort UI update; errors here should not break transcription.
                    pass

            def _has_letters(s: str) -> bool:
                for ch in s:
                    if ch.isalpha():
                        return True
                return False

            async def _emit_guesses() -> None:
                nonlocal last_emitted_word_index, total_guesses, last_submitted_guess
                if total_guesses >= max_guesses_per_recording:
                    return
                if state.winner_type is not None:
                    return

                text = current_transcript.strip()
                if not text:
                    return

                tokens = text.split()
                if last_emitted_word_index >= len(tokens):
                    return

                start_index = last_emitted_word_index
                new_tokens = tokens[start_index:]
                if not new_tokens:
                    return

                candidates: list[str] = []
                for idx in range(len(new_tokens)):
                    absolute_idx = start_index + idx
                    one = new_tokens[idx]
                    if one:
                        candidates.append(one)
                    for window in (2, 3):
                        start = absolute_idx - window + 1
                        if start < start_index:
                            continue
                        phrase = " ".join(tokens[start : absolute_idx + 1])
                        if phrase:
                            candidates.append(phrase)

                import string
                seen_local: set[str] = set()
                deduped: list[str] = []
                for cand in candidates:
                    cleaned = cand.translate(str.maketrans('', '', string.punctuation)).strip()
                    key = cleaned.lower()
                    if not key or key in seen_local or key in seen_guesses:
                        continue
                    if not _has_letters(key):
                        continue
                    seen_local.add(key)
                    deduped.append(cleaned)

                for guess_text in deduped:
                    if total_guesses >= max_guesses_per_recording:
                        break
                    if state.winner_type is not None:
                        return
                    total_guesses += 1
                    seen_guesses.add(guess_text.strip().lower())
                    last_submitted_guess = guess_text
                    await _process_guess(
                        room_id,
                        source="human",
                        guess_text=guess_text,
                        transcript=state.transcript,
                        user_id=user_id,
                        display_name=name,
                    )
                    if state.winner_type is not None:
                        return

                last_emitted_word_index = len(tokens)

            async def _chunk_worker() -> None:
                try:
                    while not done:
                        if total_guesses >= max_guesses_per_recording:
                            break
                        if state.winner_type is not None:
                            break
                        await asyncio.sleep(check_interval_seconds)
                        if done:
                            break
                        tokens_snapshot = current_transcript.split()
                        if last_emitted_word_index >= len(tokens_snapshot):
                            continue
                        if loop.time() - last_activity_time < silence_seconds and not done:
                            continue
                        await _emit_guesses()
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    logger.error(
                        "[WS_ROOM] Player chunk worker error room=%s player=%s: %s",
                        room_id,
                        name,
                        exc,
                        exc_info=True,
                    )

            chunk_task = asyncio.create_task(_chunk_worker())
            try:
                full_transcript = await transcribe_player_speech(pq, _on_delta)
                logger.info(
                    "[WS_ROOM] Player transcription finished room=%s player=%s chars=%d",
                    room_id,
                    name,
                    len(full_transcript or ""),
                )
                done = True
                await _emit_guesses()

                summary_guess = last_submitted_guess or (full_transcript or "").strip()
                if summary_guess:
                    try:
                        await websocket.send_json({"type": "VOICE_GUESS_SUBMITTED", "guess": summary_guess})
                    except Exception:
                        pass
            finally:
                done = True
                chunk_task.cancel()
                try:
                    await chunk_task
                except asyncio.CancelledError:
                    pass
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.error("[WS_ROOM] Player transcription error for %s: %s", name, exc, exc_info=True)
        finally:
            player_audio_queue_ref[0] = None
            player_task_ref[0] = None

    try:
        config_received = False

        while True:
            data = await websocket.receive()
            if data.get("type") == "websocket.disconnect":
                break
            if "bytes" in data:
                if role == "gm":
                    if audio_queue is not None:
                        chunk = data["bytes"]
                        await audio_queue.put(chunk)
                        gm_audio_chunks += 1
                        gm_audio_bytes += len(chunk)
                        if gm_audio_chunks % 100 == 0:
                            logger.info(
                                "[WS_ROOM] GM audio stream room=%s chunks=%d bytes=%d",
                                room_id,
                                gm_audio_chunks,
                                gm_audio_bytes,
                            )
                        if audio_file_path is not None:
                            audio_buffer.extend(chunk)
                            if len(audio_buffer) >= 500 * 1024:  # 500 KB buffer
                                chunk_to_write = bytes(audio_buffer)
                                audio_buffer.clear()
                                asyncio.create_task(
                                    asyncio.to_thread(_write_audio_chunk, audio_file_path, chunk_to_write)
                                )
                elif role == "player":
                    st = _get_room_state(room_id)
                    if st.started_at is None or st.winner_type is not None:
                        player_audio_drop_count += 1
                        if player_audio_drop_count % 20 == 1:
                            logger.info(
                                "[WS_ROOM] Dropping player audio room=%s player=%s started=%s winner=%s drops=%d",
                                room_id,
                                name,
                                st.started_at is not None,
                                st.winner_type,
                                player_audio_drop_count,
                            )
                        continue
                    if player_audio_queue_ref[0] is None:
                        pq: asyncio.Queue[bytes | None] = asyncio.Queue()
                        await pq.put(b"\x00\x00" * 8000)
                        player_audio_queue_ref[0] = pq
                        player_task_ref[0] = asyncio.create_task(_run_player_transcription(pq))
                        logger.info("[WS_ROOM] Opened player audio queue room=%s player=%s", room_id, name)
                    chunk = data["bytes"]
                    await player_audio_queue_ref[0].put(chunk)
                    player_audio_chunks += 1
                    player_audio_bytes += len(chunk)
                    if player_audio_chunks % 50 == 0:
                        logger.info(
                            "[WS_ROOM] Player audio stream room=%s player=%s chunks=%d bytes=%d",
                            room_id,
                            name,
                            player_audio_chunks,
                            player_audio_bytes,
                        )
                continue
            elif "text" in data:
                try:
                    msg = json.loads(data["text"])
                except json.JSONDecodeError:
                    logger.debug("[WS_ROOM] Non-JSON text from %s: %s", name, data["text"])
                    continue

                msg_type = msg.get("type")

                if role == "gm":
                    if msg_type == "START_GAME" and not config_received:
                        config_received = True
                        config = {
                            "prompt": msg.get("prompt") or "",
                            "target_word": room.target_word or "",
                            "taboo_words": msg.get("taboo_words") or [],
                            "guess_interval_ms": msg.get("guess_interval_ms"),
                        }
                        # Mark started before broadcasting GAME_STARTED so player
                        # audio frames are not dropped on initial race windows.
                        if state.started_at is None:
                            state.started_at = datetime.now(timezone.utc)
                            async with db_transaction() as session:
                                await db.update_room_on_start(session, room_id)
                                room_game_id = await db.insert_room_game(
                                    session,
                                    room_id=room_id,
                                    target_word=room.target_word or "",
                                    taboo_words=room.taboo_words,
                                )
                                state.current_room_game_id = room_game_id
                        if audio_queue is not None and game_task is None:
                            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
                            audio_dir = DATA_DIR / "audio"
                            audio_dir.mkdir(parents=True, exist_ok=True)
                            audio_file_path = str(audio_dir / f"game_{room_id}_{timestamp}.raw")

                            game_task = asyncio.create_task(start_game_loop(config))
                            game_task_ref[0] = game_task
                        await _broadcast(
                            room_id,
                            {"type": "GAME_STARTED"},
                        )
                        continue

                    if msg_type == "TIME_UP":
                        lock = _get_room_lock(room_id)
                        async with lock:
                            st = _get_room_state(room_id)
                            if st.winner_type is None:
                                st.winner_type = "time_up"
                                async with db_transaction() as session:
                                    await db.update_room_outcome(
                                        session,
                                        room_id=room_id,
                                        status=db.ROOM_STATUS_LOST,
                                        time_remaining_seconds=0,
                                        final_transcript=st.transcript,
                                        winning_guess=None,
                                        winner_type="time_up",
                                        winner_user_id=None,
                                        winner_display_name=None,
                                    )
                                    if st.current_room_game_id is not None:
                                        await db.update_room_game_outcome(
                                            session,
                                            st.current_room_game_id,
                                            ended_at=datetime.now(timezone.utc),
                                            winner_type="time_up",
                                            final_transcript=st.transcript,
                                        )
                                await _broadcast(
                                    room_id,
                                    {
                                        "type": "GAME_OVER",
                                        "winnerType": "time_up",
                                        "targetWord": getattr(room, "target_word", ""),
                                    },
                                )
                                if game_task_ref[0] is not None:
                                    game_task_ref[0].cancel()
                        continue

                    if msg_type == "NEW_GAME":
                        lock = _get_room_lock(room_id)
                        async with lock:
                            config_received = False
                            
                            # Flush audio buffer for the old game
                            if audio_file_path is not None and audio_buffer:
                                chunk_to_write = bytes(audio_buffer)
                                audio_buffer.clear()
                                asyncio.create_task(
                                    asyncio.to_thread(_write_audio_chunk, audio_file_path, chunk_to_write)
                                )
                            audio_file_path = None

                            if game_task_ref[0] is not None:
                                game_task_ref[0].cancel()
                                try:
                                    await game_task_ref[0]
                                except asyncio.CancelledError:
                                    pass
                                game_task_ref[0] = None
                                game_task = None

                            if audio_queue is not None:
                                while not audio_queue.empty():
                                    audio_queue.get_nowait()

                            new_target = msg.get("target_word", room.target_word)
                            new_taboo = msg.get("taboo_words", [])
                            room.target_word = new_target
                            room.taboo_words = db.encode_taboo_words(new_taboo)

                            st = _get_room_state(room_id)
                            st.target_word = new_target
                            st.transcript = ""
                            st.winner_type = None
                            st.winner_user_id = None
                            st.winner_display_name = None
                            st.winning_guess = None
                            st.started_at = None
                            st.current_room_game_id = None
                            st.llm_guesses = []
                            st.other_guesses = []
                            st.recent_guesses = []

                            async with db_transaction() as session:
                                await db.reset_room_for_new_game(
                                    session,
                                    room_id=room_id,
                                    target_word=new_target,
                                    taboo_words=room.taboo_words,
                                )

                            await _broadcast(
                                room_id,
                                {
                                    "type": "NEW_GAME_PREPARING",
                                    "targetWord": new_target,
                                    "tabooWords": new_taboo,
                                }
                            )
                        continue

                if msg_type == "GUESS_SUBMIT":
                    guess_text = str(msg.get("guess") or "").strip()
                    if not guess_text:
                        continue
                    
                    import re
                    parts = [p.strip() for p in re.split(r'[,.!\?]', guess_text) if p.strip()]
                    if not parts:
                        parts = [guess_text]
                        
                    for part in parts:
                        await _process_guess(
                            room_id,
                            source="human",
                            guess_text=part,
                            transcript=state.transcript,
                            user_id=user_id,
                            display_name=name,
                        )
                elif msg_type == "PLAYER_AUDIO_STOP":
                    if player_audio_queue_ref[0] is not None:
                        logger.info(
                            "[WS_ROOM] PLAYER_AUDIO_STOP room=%s player=%s chunks=%d bytes=%d",
                            room_id,
                            name,
                            player_audio_chunks,
                            player_audio_bytes,
                        )
                        await player_audio_queue_ref[0].put(None)
                else:
                    logger.debug("[WS_ROOM] Ignoring message type=%s from %s", msg_type, name)
    except WebSocketDisconnect:
        logger.info("[WS_ROOM] Client %s disconnected from room %s", name, room_id)
    except RuntimeError as exc:
        if "disconnect" in str(exc).lower() and "receive" in str(exc).lower():
            logger.info("[WS_ROOM] Client %s disconnected from room %s", name, room_id)
        else:
            raise
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("[WS_ROOM] Error in room %s: %s", room_id, exc, exc_info=True)
    finally:
        _remove_connection(room_id, websocket)
        await _broadcast_players(room_id)
        if player_task_ref[0] is not None:
            player_task_ref[0].cancel()
            try:
                await player_task_ref[0]
            except asyncio.CancelledError:
                pass
        if role == "gm":
            if audio_file_path is not None and audio_buffer:
                chunk_to_write = bytes(audio_buffer)
                audio_buffer.clear()
                asyncio.create_task(
                    asyncio.to_thread(_write_audio_chunk, audio_file_path, chunk_to_write)
                )

            if audio_queue is not None:
                await audio_queue.put(None)
            if game_task is not None:
                game_task.cancel()
                try:
                    await game_task
                except asyncio.CancelledError:
                    pass

            # If the GM disconnects and no winner was decided, mark the room as stopped.
            state = _get_room_state(room_id)
            if state.winner_type is None:
                async with db_transaction() as session:
                    await db.update_room_outcome(
                        session,
                        room_id=room_id,
                        status=db.ROOM_STATUS_STOPPED,
                        time_remaining_seconds=None,
                        final_transcript=state.transcript,
                        winning_guess=None,
                        winner_type=None,
                        winner_user_id=None,
                        winner_display_name=None,
                    )
