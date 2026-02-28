import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from backend.app.api.rooms import get_current_room_context
from backend.app.auth.jwt import JwtError
from backend.app.db.connection import async_session_factory
from backend.app.db import repository as db
from backend.app.db.schemas import RoomSchema
from backend.app.services.game_service import check_win_for_word, contains_taboo, run_room_game


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
    winner_type: str | None = None  # "human" | "AI"
    winner_user_id: str | None = None
    winner_display_name: str | None = None
    winning_guess: str | None = None
    started_at: datetime | None = None


_room_connections: Dict[int, List[RoomConnection]] = {}
_room_states: Dict[int, RoomGameState] = {}
_room_locks: Dict[int, asyncio.Lock] = {}


def _get_room_state(room_id: int) -> RoomGameState:
    if room_id not in _room_states:
        _room_states[room_id] = RoomGameState()
    return _room_states[room_id]


def _get_room_lock(room_id: int) -> asyncio.Lock:
    if room_id not in _room_locks:
        _room_locks[room_id] = asyncio.Lock()
    return _room_locks[room_id]


def _add_connection(room_id: int, conn: RoomConnection) -> None:
    _room_connections.setdefault(room_id, []).append(conn)


def _remove_connection(room_id: int, websocket: WebSocket) -> None:
    conns = _room_connections.get(room_id)
    if not conns:
        return
    _room_connections[room_id] = [c for c in conns if c.websocket is not websocket]
    if not _room_connections[room_id]:
        _room_connections.pop(room_id, None)


async def _broadcast(room_id: int, payload: Dict[str, Any]) -> None:
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


async def _process_guess(
    room_id: int,
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
        async with async_session_factory() as session:
            async with session.begin():
                room: RoomSchema | None = await db.get_room(session, room_id)
                if not room:
                    logger.warning("Received guess for missing room_id=%s", room_id)
                    return

                target_word = room.target_word or ""
                is_correct = check_win_for_word(guess_text, target_word)

                state = _get_room_state(room_id)
                already_has_winner = state.winner_type is not None

                # Persist guess. Only the first winning guess is marked is_win=True.
                is_win_for_row = bool(is_correct and not already_has_winner)
                await db.insert_guess(
                    session,
                    game_id=room_id,
                    guess_text=guess_text,
                    is_win=is_win_for_row,
                    user_id=user_id,
                    display_name=display_name,
                    source=source,
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

                if not is_correct or already_has_winner:
                    return

                # This is the first winning guess.
                winner_type = "AI" if source == "AI" else "human"
                state.winner_type = winner_type
                state.winner_user_id = user_id
                state.winner_display_name = display_name
                state.winning_guess = guess_text

                await db.update_room_outcome(
                    session,
                    room_id=room_id,
                    status=db.ROOM_STATUS_WON,
                    time_remaining_seconds=None,
                    final_transcript=state.transcript or transcript,
                    winning_guess=guess_text,
                    winner_type=winner_type,
                    winner_user_id=user_id,
                    winner_display_name=display_name,
                )

        # Broadcast GAME_OVER with winner metadata (outside session scope).
        ended_at = datetime.now(timezone.utc)
        duration_seconds: int | None = None
        if state.started_at:
            duration_seconds = int((ended_at - state.started_at).total_seconds())

        await _broadcast(
            room_id,
            {
                "type": "GAME_OVER",
                "winnerType": winner_type,
                "winnerDisplayName": display_name,
                "winningGuess": guess_text,
                "durationSeconds": duration_seconds,
            },
        )


@router.websocket("/room/{room_id}")
async def websocket_room_endpoint(websocket: WebSocket, room_id: int) -> None:
    """
    Multi-participant room WebSocket.

    - GM: streams audio + initial config; drives Mistral transcription and AI guesses.
    - Players: see transcript, submit text guesses.
    """
    await websocket.accept()
    raw_token = websocket.query_params.get("token")

    try:
        async with async_session_factory() as session:
            async with session.begin():
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

    logger.info("WebSocket connected to room %s as %s (%s)", room_id, name, role)

    _add_connection(room_id, RoomConnection(websocket=websocket, user_id=user_id, name=name, role=role))

    state = _get_room_state(room_id)

    # GM-specific setup: audio queue + game loop.
    audio_queue: asyncio.Queue[bytes | None] | None = None
    game_task: asyncio.Task | None = None
    game_task_ref: List[asyncio.Task | None] = [None]

    if role == "gm":
        audio_queue = asyncio.Queue()

        async def handle_taboo_violation(
            rid: int,
            task_ref: List[asyncio.Task | None],
        ) -> None:
            lock = _get_room_lock(rid)
            async with lock:
                st = _get_room_state(rid)
                if st.winner_type is not None:
                    return
                st.winner_type = "gm_lost"
                async with async_session_factory() as session:
                    async with session.begin():
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
            if contains_taboo(transcript, taboo_words):
                asyncio.create_task(handle_taboo_violation(room_id, game_task_ref))

        async def on_ai_guess(guess: str, transcript: str) -> None:
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
                async with async_session_factory() as session:
                    async with session.begin():
                        await db.update_room_on_start(session, room_id)
            assert audio_queue is not None
            await run_room_game(
                config=config,
                audio_queue=audio_queue,
                on_transcript_update=on_transcript_update,
                on_ai_guess=on_ai_guess,
            )

    try:
        config_received = False

        while True:
            data = await websocket.receive()
            if data.get("type") == "websocket.disconnect":
                break
            if "bytes" in data:
                if role != "gm" or audio_queue is None:
                    continue
                await audio_queue.put(data["bytes"])
            elif "text" in data:
                try:
                    msg = json.loads(data["text"])
                except json.JSONDecodeError:
                    logger.debug("[WS_ROOM] Non-JSON text from %s: %s", name, data["text"])
                    continue

                msg_type = msg.get("type")

                if role == "gm" and not config_received:
                    config_received = True
                    config = {
                        "prompt": msg.get("prompt") or "",
                        "target_word": room.target_word or "",
                        "taboo_words": msg.get("taboo_words") or [],
                    }
                    if audio_queue is not None and game_task is None:
                        game_task = asyncio.create_task(start_game_loop(config))
                        game_task_ref[0] = game_task
                    await _broadcast(
                        room_id,
                        {"type": "GAME_STARTED"},
                    )
                    continue

                if msg_type == "GUESS_SUBMIT":
                    guess_text = str(msg.get("guess") or "").strip()
                    if not guess_text:
                        continue
                    await _process_guess(
                        room_id,
                        source="human",
                        guess_text=guess_text,
                        transcript=state.transcript,
                        user_id=user_id,
                        display_name=name,
                    )
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
        if role == "gm":
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
                async with async_session_factory() as session:
                    async with session.begin():
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
