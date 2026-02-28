"""
Game orchestration: consume audio queue, run Mistral transcription and guesser,
persist games and guesses. No HTTP/WS handling beyond sending responses.

Set AI_MODE=api  (default) to use Mistral hosted APIs.
Set AI_MODE=vllm           to use locally-running vLLM model servers.
"""
import asyncio
import json
import logging
import os
import re
from typing import Any, Awaitable, Callable

from fastapi import WebSocket
from mistralai import Mistral

from backend.app.db.connection import async_session_factory
from backend.app.db import repository as db
from backend.app.services.guesser_prompt import get_guesser_system_prompt
from backend.app.services.mistral_service import (
    guess_word,
    get_event_types,
    transcribe_stream,
)
from backend.app.services import vllm_service

logger = logging.getLogger(__name__)

# ── AI backend selection ─────────────────────────────────────────────────────
AI_MODE = os.environ.get("AI_MODE", "api").lower()
if AI_MODE not in ("api", "vllm"):
    logger.warning("[GAME] Unknown AI_MODE=%r — falling back to 'api'", AI_MODE)
    AI_MODE = "api"
logger.info("[GAME] AI_MODE=%s", AI_MODE)

if AI_MODE == "vllm":
    # Fail fast at startup if the vLLM servers aren't reachable rather than
    # discovering the problem during the first game session.
    try:
        vllm_service.check_vllm_health()
        logger.info("[GAME] vLLM health check passed — both model servers are reachable.")
    except RuntimeError as _vllm_health_err:
        raise RuntimeError(str(_vllm_health_err)) from None

# Unpack Mistral SDK event types (used regardless of mode for isinstance checks
# in the API path; vLLM service exposes its own compatible synthetic types).
RealtimeTranscriptionSessionCreated, TranscriptionStreamTextDelta, TranscriptionStreamDone, RealtimeTranscriptionError, UnknownRealtimeEvent = get_event_types()
# Unpack vLLM synthetic event types (same positional ordering)
(_VllmSessionCreated, _VllmTextDelta, _VllmStreamDone, _VllmStreamError, _VllmUnknownEvent) = vllm_service.get_event_types_vllm()

# WebSocket.CONNECTED value in starlette
WS_CONNECTED = 1
DEFAULT_GUESS_INTERVAL_MS = 200


async def _send_if_connected(ws: WebSocket, payload: dict[str, Any]) -> None:
    if ws.client_state.value == WS_CONNECTED:
        await ws.send_json(payload)
    else:
        logger.warning("[GUESSER] WebSocket not connected, dropping message: %s", list(payload.keys()))


async def _queue_audio_stream(audio_queue: asyncio.Queue[bytes | None]):
    while True:
        chunk = await audio_queue.get()
        if chunk is None:
            break
        yield chunk


async def _cancel_task(task: asyncio.Task[Any] | None) -> None:
    if task is None:
        return
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


def _normalize(s: str) -> str:
    return s.lower().replace("\n", " ").strip()


def _word_count(s: str) -> int:
    """
    Count whitespace-separated words in a string.
    Used to gate guessing until enough words have been spoken.
    """
    return len(s.split())


def _check_win(guess: str, target_word: str) -> bool:
    if not target_word:
        return False
    clean_guess = _normalize(guess)
    clean_target = _normalize(target_word)
    if not clean_target:
        return False

    target_tokens = clean_target.split()
    if len(target_tokens) == 1:
        # For single-word targets, require an exact match only.
        return clean_guess == clean_target

    if clean_guess == clean_target:
        return True
    escaped = re.escape(clean_target)
    return bool(re.search(rf"\b{escaped}\b", clean_guess))


def check_win_for_word(guess: str, target_word: str) -> bool:
    """
    Public helper so other modules (e.g. WebSocket room handler) can reuse
    the same win-checking logic as the legacy single-player game.
    """
    return _check_win(guess, target_word)


def contains_taboo(transcript: str, taboo_words: list) -> bool:
    """Case-insensitive check if any taboo word appears in the transcript."""
    if not transcript or not taboo_words:
        return False
    transcript_lower = transcript.lower()
    for word in taboo_words:
        if not isinstance(word, str):
            continue
        w = word.strip().lower()
        if w and w in transcript_lower:
            return True
    return False


async def run_game(
    websocket: WebSocket,
    config: dict[str, Any],
    audio_queue: asyncio.Queue[bytes | None],
) -> None:
    """
    Consume audio from audio_queue, stream to transcription backend (API or vLLM),
    send transcript updates and AI guesses; persist game and guesses.
    """
    prompt = get_guesser_system_prompt()
    target_word = config.get("target_word") or ""
    taboo_words = config.get("taboo_words")
    if taboo_words is None:
        taboo_words = []
    taboo_str = json.dumps(taboo_words) if isinstance(taboo_words, list) else str(taboo_words)

    game_id: int | None = None

    guess_interval_ms = _coerce_guess_interval_ms(config.get("guess_interval_ms"))
    guess_interval_s = guess_interval_ms / 1000
    state: dict[str, Any] = {"transcript": "", "taboo_violated": False, "stopped": False}
    logger.info("[GUESSER] Interval configured to %sms (AI_MODE=%s)", guess_interval_ms, AI_MODE)
    try:
        async with async_session_factory() as session:
            async with session.begin():
                game_id = await db.insert_game(session, target_word=target_word, taboo_words=taboo_str)
        assert game_id is not None
        logger.info("[GAME] Created game_id=%s target_word=%s", game_id, target_word or "(none)")

        if AI_MODE == "vllm":
            # ── vLLM path ────────────────────────────────────────────────
            guess_loop_task = asyncio.create_task(
                _run_single_game_guess_loop_vllm(
                    prompt=prompt,
                    game_id=game_id,
                    target_word=target_word,
                    websocket=websocket,
                    state=state,
                    guess_interval_s=guess_interval_s,
                )
            )
            try:
                async for event in vllm_service.transcribe_stream_vllm(
                    audio_queue, model=vllm_service.TRANSCRIBER_MODEL
                ):
                    if isinstance(event, _VllmSessionCreated):
                        logger.info("[VLLM] Realtime transcription session created")
                    elif isinstance(event, _VllmTextDelta):
                        state["transcript"] += event.text
                        await _send_if_connected(
                            websocket,
                            {"type": "TRANSCRIPT_UPDATE", "transcript": state["transcript"]},
                        )
                        if contains_taboo(state["transcript"], taboo_words):
                            state["taboo_violated"] = True
                            break
                    elif isinstance(event, _VllmStreamDone):
                        logger.info("[VLLM] Transcription stream done")
                    elif isinstance(event, _VllmStreamError):
                        logger.error("[VLLM] Stream error: %s", event.message)
                    elif isinstance(event, _VllmUnknownEvent):
                        logger.warning("[VLLM] Unknown event: %s", event.data)
            finally:
                await _cancel_task(guess_loop_task)
        else:
            # ── Mistral API path (default) ────────────────────────────────
            api_key = os.environ.get("MISTRAL_API_KEY")
            if not api_key:
                logger.error("MISTRAL_API_KEY is not set")
                return
            client = Mistral(api_key=api_key)
            guess_loop_task = asyncio.create_task(
                _run_single_game_guess_loop(
                    client=client,
                    prompt=prompt,
                    game_id=game_id,
                    target_word=target_word,
                    websocket=websocket,
                    state=state,
                    guess_interval_s=guess_interval_s,
                )
            )
            try:
                async for event in transcribe_stream(client, _queue_audio_stream(audio_queue)):
                    if isinstance(event, RealtimeTranscriptionSessionCreated):
                        logger.info("[MISTRAL] Realtime transcription session created")
                    elif isinstance(event, TranscriptionStreamTextDelta):
                        state["transcript"] += event.text
                        await _send_if_connected(
                            websocket,
                            {"type": "TRANSCRIPT_UPDATE", "transcript": state["transcript"]},
                        )
                        if contains_taboo(state["transcript"], taboo_words):
                            state["taboo_violated"] = True
                            break
                    elif isinstance(event, TranscriptionStreamDone):
                        logger.info("[MISTRAL] Transcription stream done")
                    elif isinstance(event, RealtimeTranscriptionError):
                        logger.error("[MISTRAL] RealtimeTranscriptionError: %s", event)
                    elif isinstance(event, UnknownRealtimeEvent):
                        logger.warning("[MISTRAL] UnknownRealtimeEvent: %s", event)
            finally:
                await _cancel_task(guess_loop_task)

    except asyncio.CancelledError:
        raise
    except Exception as e:
        logger.error("[GAME] Error: %s", e, exc_info=True)
    finally:
        if game_id:
            async with async_session_factory() as session:
                async with session.begin():
                    row = await db.get_game(session, game_id)
                    if row and row.outcome == OUTCOME_PLAYING:
                        if state.get("taboo_violated"):
                            await db.update_game_outcome(
                                session,
                                game_id,
                                outcome=db.OUTCOME_LOST,
                                final_transcript=state.get("transcript") or None,
                            )
                            await _send_if_connected(
                                websocket,
                                {"type": "GAME_OVER", "tabooViolation": True},
                            )
                        else:
                            await db.update_game_outcome(
                                session,
                                game_id,
                                outcome=db.OUTCOME_STOPPED,
                                final_transcript=state.get("transcript") or None,
                            )

# Keep constant accessible from the finally block above
OUTCOME_PLAYING = db.OUTCOME_PLAYING


async def _guesser_task(
    client: Any,
    prompt: str,
    transcript_delta: str,
    full_transcript: str,
    game_id: int,
    target_word: str,
    websocket: WebSocket,
    chat_history: list[dict],
) -> bool:
    """
    Make one AI guess (Mistral API path).  Uses the in-memory chat_history so
    no DB round-trip is needed.  Appends the new user/assistant turns in-place.
    """
    if not transcript_delta.strip():
        return False
    logger.info(
        "[GUESSER] Firing guess on delta (%s words), history_turns=%d: '%.120s'",
        len(transcript_delta.split()),
        len(chat_history),
        transcript_delta,
    )
    try:
        history_snapshot = list(chat_history)
        guess, updated_history = await guess_word(
            client, prompt, transcript_delta, history_snapshot
        )
        logger.info("[GUESSER] AI says: '%s'", guess)
        if not guess:
            return False
        # Extend in-place so the reference shared with the caller is updated.
        new_turns = updated_history[len(history_snapshot):]
        chat_history.extend(new_turns)

        is_win = _check_win(guess, target_word)
        async with async_session_factory() as session:
            async with session.begin():
                await db.insert_guess(session, guess_text=guess, is_win=is_win, game_id=game_id)
                if is_win:
                    await db.update_game_outcome(
                        session,
                        game_id,
                        outcome=db.OUTCOME_WON,
                        winning_guess=guess,
                        final_transcript=full_transcript,
                    )
        await _send_if_connected(websocket, {"type": "AI_GUESS", "guess": guess})
        return is_win
    except Exception as e:
        logger.error("[GUESSER] Error: %s", e, exc_info=True)
    return False


async def _guesser_task_vllm(
    prompt: str,
    transcript_delta: str,
    full_transcript: str,
    game_id: int,
    target_word: str,
    websocket: WebSocket,
    chat_history: list[dict],
) -> bool:
    """
    Make one AI guess (vLLM path). Same logic as _guesser_task but calls
    vllm_service.guess_word_vllm instead of the Mistral SDK.
    """
    if not transcript_delta.strip():
        return False
    logger.info(
        "[VLLM_GUESSER] Firing guess on delta (%s words), history_turns=%d: '%.120s'",
        len(transcript_delta.split()),
        len(chat_history),
        transcript_delta,
    )
    try:
        history_snapshot = list(chat_history)
        guess, updated_history = await vllm_service.guess_word_vllm(
            prompt, transcript_delta, history_snapshot
        )
        logger.info("[VLLM_GUESSER] AI says: '%s'", guess)
        if not guess:
            return False
        new_turns = updated_history[len(history_snapshot):]
        chat_history.extend(new_turns)

        is_win = _check_win(guess, target_word)
        async with async_session_factory() as session:
            async with session.begin():
                await db.insert_guess(session, guess_text=guess, is_win=is_win, game_id=game_id)
                if is_win:
                    await db.update_game_outcome(
                        session,
                        game_id,
                        outcome=db.OUTCOME_WON,
                        winning_guess=guess,
                        final_transcript=full_transcript,
                    )
        await _send_if_connected(websocket, {"type": "AI_GUESS", "guess": guess})
        return is_win
    except Exception as exc:
        logger.error("[VLLM_GUESSER] Error: %s", exc, exc_info=True)
    return False


async def _run_single_game_guess_loop(
    client: Any,
    prompt: str,
    game_id: int,
    target_word: str,
    websocket: WebSocket,
    state: dict[str, Any],
    guess_interval_s: float,
) -> None:
    """Guess loop for Mistral API mode."""
    chat_history: list[dict] = []
    last_transcript_pos: int = 0
    while True:
        if state.get("taboo_violated") or state.get("stopped"):
            return
        full_transcript = str(state.get("transcript") or "").strip()
        delta = full_transcript[last_transcript_pos:]
        if delta.strip() and _word_count(full_transcript) >= 3:
            is_win = await _guesser_task(
                client=client,
                prompt=prompt,
                transcript_delta=delta,
                full_transcript=full_transcript,
                game_id=game_id,
                target_word=target_word,
                websocket=websocket,
                chat_history=chat_history,
            )
            last_transcript_pos = len(full_transcript)
            if is_win:
                state["stopped"] = True
                return
        await asyncio.sleep(guess_interval_s)


async def _run_single_game_guess_loop_vllm(
    prompt: str,
    game_id: int,
    target_word: str,
    websocket: WebSocket,
    state: dict[str, Any],
    guess_interval_s: float,
) -> None:
    """Guess loop for vLLM mode."""
    chat_history: list[dict] = []
    last_transcript_pos: int = 0
    while True:
        if state.get("taboo_violated") or state.get("stopped"):
            return
        full_transcript = str(state.get("transcript") or "").strip()
        delta = full_transcript[last_transcript_pos:]
        if delta.strip() and _word_count(full_transcript) >= 3:
            is_win = await _guesser_task_vllm(
                prompt=prompt,
                transcript_delta=delta,
                full_transcript=full_transcript,
                game_id=game_id,
                target_word=target_word,
                websocket=websocket,
                chat_history=chat_history,
            )
            last_transcript_pos = len(full_transcript)
            if is_win:
                state["stopped"] = True
                return
        await asyncio.sleep(guess_interval_s)


async def run_room_game(
    config: dict[str, Any],
    audio_queue: asyncio.Queue[bytes | None],
    on_transcript_update: Callable[[str], Awaitable[None]],
    on_ai_guess: Callable[[str, str], Awaitable[None]],
    chat_history: list[dict] | None = None,
) -> None:
    """
    Room-aware variant of the game loop (supports both API and vLLM modes).

    Responsibilities:
    - Consume audio from audio_queue.
    - Stream to transcription backend (Mistral API or local vLLM).
    - Call on_transcript_update(transcript) whenever new text arrives.
    - Periodically run the AI guesser on the transcript delta and call
      on_ai_guess(guess, full_transcript) with the result.

    chat_history: optional mutable list shared with the caller. The loop appends
    new AI turns to it in-place. Callers (e.g. ws_room) may also append human
    guess events to the same list so the AI sees the full guess history without
    any database round-trips.

    This function does not know about WebSockets or the database; callers
    (e.g. ws_room) are responsible for broadcasting and persistence, and
    for enforcing win logic (human vs AI).
    """
    prompt = get_guesser_system_prompt()

    guess_interval_ms = _coerce_guess_interval_ms(config.get("guess_interval_ms"))
    guess_interval_s = guess_interval_ms / 1000
    state: dict[str, Any] = {"transcript": ""}
    logger.info("[ROOM_GUESSER] Interval configured to %sms (AI_MODE=%s)", guess_interval_ms, AI_MODE)

    # Use the caller-supplied list so that external events (e.g. human guesses)
    # appended by ws_room are visible to the guesser loop without any DB query.
    shared_history: list[dict] = chat_history if chat_history is not None else []

    if AI_MODE == "vllm":
        # ── vLLM path ────────────────────────────────────────────────────
        guess_loop_task = asyncio.create_task(
            _run_room_guess_loop_vllm(
                prompt=prompt,
                state=state,
                on_ai_guess=on_ai_guess,
                chat_history=shared_history,
                guess_interval_s=guess_interval_s,
            )
        )
        try:
            async for event in vllm_service.transcribe_stream_vllm(
                audio_queue, model=vllm_service.TRANSCRIBER_MODEL
            ):
                if isinstance(event, _VllmSessionCreated):
                    logger.info("[VLLM] Realtime transcription session created (room)")
                elif isinstance(event, _VllmTextDelta):
                    state["transcript"] += event.text
                    await on_transcript_update(state["transcript"])
                elif isinstance(event, _VllmStreamDone):
                    logger.info("[VLLM] Transcription stream done (room)")
                elif isinstance(event, _VllmStreamError):
                    logger.error("[VLLM] Stream error (room): %s", event.message)
                elif isinstance(event, _VllmUnknownEvent):
                    logger.warning("[VLLM] Unknown event (room): %s", event.data)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.error("[ROOM_GAME_VLLM] Error: %s", exc, exc_info=True)
        finally:
            await _cancel_task(guess_loop_task)
    else:
        # ── Mistral API path (default) ────────────────────────────────────
        api_key = os.environ.get("MISTRAL_API_KEY")
        if not api_key:
            logger.error("MISTRAL_API_KEY is not set")
            return

        # Guesser receives only game rules + transcript; never target_word, options, or hints.
        client = Mistral(api_key=api_key)

        guess_loop_task = asyncio.create_task(
            _run_room_guess_loop(
                client=client,
                prompt=prompt,
                state=state,
                on_ai_guess=on_ai_guess,
                chat_history=shared_history,
                guess_interval_s=guess_interval_s,
            )
        )
        try:
            async for event in transcribe_stream(client, _queue_audio_stream(audio_queue)):
                if isinstance(event, RealtimeTranscriptionSessionCreated):
                    logger.info("[MISTRAL] Realtime transcription session created (room)")
                elif isinstance(event, TranscriptionStreamTextDelta):
                    state["transcript"] += event.text
                    await on_transcript_update(state["transcript"])
                elif isinstance(event, TranscriptionStreamDone):
                    logger.info("[MISTRAL] Transcription stream done (room)")
                elif isinstance(event, RealtimeTranscriptionError):
                    logger.error("[MISTRAL] RealtimeTranscriptionError (room): %s", event)
                elif isinstance(event, UnknownRealtimeEvent):
                    logger.warning("[MISTRAL] UnknownRealtimeEvent (room): %s", event)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.error("[ROOM_GAME] Error: %s", exc, exc_info=True)
        finally:
            await _cancel_task(guess_loop_task)


async def _room_ai_guesser_task(
    client: Any,
    prompt: str,
    transcript_delta: str,
    full_transcript: str,
    on_ai_guess: Callable[[str, str], Awaitable[None]],
    chat_history: list[dict],
) -> None:
    """
    Make one AI guess for a room game (Mistral API path). Uses the shared
    in-memory chat_history.  Appends new turns in-place.
    """
    if not transcript_delta.strip():
        return
    logger.info(
        "[ROOM_GUESSER] Firing guess on delta (%s words), history_turns=%d: '%.120s'",
        len(transcript_delta.split()),
        len(chat_history),
        transcript_delta,
    )
    try:
        history_snapshot = list(chat_history)
        guess, updated_history = await guess_word(
            client, prompt, transcript_delta, history_snapshot
        )
        logger.info("[ROOM_GUESSER] AI says: '%s'", guess)
        if not guess:
            return
        # Append only the new AI turns.  Any human-guess events inserted into
        # chat_history during the await are preserved because we use extend, not
        # clear+replace.
        new_turns = updated_history[len(history_snapshot):]
        chat_history.extend(new_turns)
        await on_ai_guess(guess, full_transcript)
    except Exception as exc:
        logger.error("[ROOM_GUESSER] Error: %s", exc, exc_info=True)


async def _room_ai_guesser_task_vllm(
    prompt: str,
    transcript_delta: str,
    full_transcript: str,
    on_ai_guess: Callable[[str, str], Awaitable[None]],
    chat_history: list[dict],
) -> None:
    """
    Make one AI guess for a room game (vLLM path). Same logic as
    _room_ai_guesser_task but calls vllm_service.guess_word_vllm.
    """
    if not transcript_delta.strip():
        return
    logger.info(
        "[ROOM_VLLM_GUESSER] Firing guess on delta (%s words), history_turns=%d: '%.120s'",
        len(transcript_delta.split()),
        len(chat_history),
        transcript_delta,
    )
    try:
        history_snapshot = list(chat_history)
        guess, updated_history = await vllm_service.guess_word_vllm(
            prompt, transcript_delta, history_snapshot
        )
        logger.info("[ROOM_VLLM_GUESSER] AI says: '%s'", guess)
        if not guess:
            return
        new_turns = updated_history[len(history_snapshot):]
        chat_history.extend(new_turns)
        await on_ai_guess(guess, full_transcript)
    except Exception as exc:
        logger.error("[ROOM_VLLM_GUESSER] Error: %s", exc, exc_info=True)


async def _run_room_guess_loop(
    client: Any,
    prompt: str,
    state: dict[str, Any],
    on_ai_guess: Callable[[str, str], Awaitable[None]],
    chat_history: list[dict],
    guess_interval_s: float,
) -> None:
    """Guess loop for Mistral API room mode."""
    last_transcript_pos: int = 0
    while True:
        full_transcript = str(state.get("transcript") or "").strip()
        delta = full_transcript[last_transcript_pos:]
        if delta.strip() and _word_count(full_transcript) >= 3:
            await _room_ai_guesser_task(
                client=client,
                prompt=prompt,
                transcript_delta=delta,
                full_transcript=full_transcript,
                on_ai_guess=on_ai_guess,
                chat_history=chat_history,
            )
            last_transcript_pos = len(full_transcript)
        await asyncio.sleep(guess_interval_s)


async def _run_room_guess_loop_vllm(
    prompt: str,
    state: dict[str, Any],
    on_ai_guess: Callable[[str, str], Awaitable[None]],
    chat_history: list[dict],
    guess_interval_s: float,
) -> None:
    """Guess loop for vLLM room mode."""
    last_transcript_pos: int = 0
    while True:
        full_transcript = str(state.get("transcript") or "").strip()
        delta = full_transcript[last_transcript_pos:]
        if delta.strip() and _word_count(full_transcript) >= 3:
            await _room_ai_guesser_task_vllm(
                prompt=prompt,
                transcript_delta=delta,
                full_transcript=full_transcript,
                on_ai_guess=on_ai_guess,
                chat_history=chat_history,
            )
            last_transcript_pos = len(full_transcript)
        await asyncio.sleep(guess_interval_s)


async def transcribe_player_speech(
    audio_queue: asyncio.Queue[bytes | None],
    on_transcript_delta: Callable[[str], Awaitable[None]],
) -> str:
    """
    Transcribe a player's audio stream via Mistral Realtime API or local vLLM.

    Consumes audio_queue until a None sentinel is received, calls
    on_transcript_delta(full_transcript_so_far) on each delta, and returns the
    complete accumulated transcript when the stream ends.
    """
    full_transcript = ""

    if AI_MODE == "vllm":
        try:
            async for event in vllm_service.transcribe_stream_vllm(
                audio_queue, model=vllm_service.TRANSCRIBER_MODEL
            ):
                if isinstance(event, _VllmSessionCreated):
                    logger.info("[PLAYER_TRANSCRIBE_VLLM] Realtime session created")
                elif isinstance(event, _VllmTextDelta):
                    full_transcript += event.text
                    await on_transcript_delta(full_transcript)
                elif isinstance(event, _VllmStreamDone):
                    logger.info("[PLAYER_TRANSCRIBE_VLLM] Transcription stream done")
                elif isinstance(event, _VllmStreamError):
                    logger.error("[PLAYER_TRANSCRIBE_VLLM] Error: %s", event.message)
                elif isinstance(event, _VllmUnknownEvent):
                    logger.warning("[PLAYER_TRANSCRIBE_VLLM] Unknown event: %s", event.data)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.error("[PLAYER_TRANSCRIBE_VLLM] Error: %s", exc, exc_info=True)
    else:
        api_key = os.environ.get("MISTRAL_API_KEY")
        if not api_key:
            logger.error("MISTRAL_API_KEY is not set — cannot transcribe player speech")
            return ""
        client = Mistral(api_key=api_key)
        try:
            async for event in transcribe_stream(client, _queue_audio_stream(audio_queue)):
                if isinstance(event, RealtimeTranscriptionSessionCreated):
                    logger.info("[PLAYER_TRANSCRIBE] Realtime session created")
                elif isinstance(event, TranscriptionStreamTextDelta):
                    full_transcript += event.text
                    await on_transcript_delta(full_transcript)
                elif isinstance(event, TranscriptionStreamDone):
                    logger.info("[PLAYER_TRANSCRIBE] Transcription stream done")
                elif isinstance(event, RealtimeTranscriptionError):
                    logger.error("[PLAYER_TRANSCRIBE] RealtimeTranscriptionError: %s", event)
                elif isinstance(event, UnknownRealtimeEvent):
                    logger.warning("[PLAYER_TRANSCRIBE] UnknownRealtimeEvent: %s", event)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.error("[PLAYER_TRANSCRIBE] Error: %s", exc, exc_info=True)

    return full_transcript.strip()


def _coerce_guess_interval_ms(raw_value: Any) -> int:
    try:
        interval_ms = int(raw_value)
        if interval_ms <= 0:
            raise ValueError("interval must be positive")
        return interval_ms
    except (TypeError, ValueError):
        return DEFAULT_GUESS_INTERVAL_MS
