"""
Game orchestration: consume audio queue, run Mistral transcription and guesser,
persist games and guesses. No HTTP/WS handling beyond sending responses.
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

logger = logging.getLogger(__name__)

RealtimeTranscriptionSessionCreated, TranscriptionStreamTextDelta, TranscriptionStreamDone, RealtimeTranscriptionError, UnknownRealtimeEvent = get_event_types()

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
    Consume audio from audio_queue, stream to Mistral transcription, send transcript
    updates and AI guesses; persist game and guesses. Runs until queue is closed (None).
    """
    api_key = os.environ.get("MISTRAL_API_KEY")
    if not api_key:
        logger.error("MISTRAL_API_KEY is not set")
        return

    # Guesser receives only game rules + transcript (from guesser_prompt); never target_word, options, or hints.
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
    logger.info("[GUESSER] Interval configured to %sms", guess_interval_ms)
    try:
        async with async_session_factory() as session:
            async with session.begin():
                game_id = await db.insert_game(session, target_word=target_word, taboo_words=taboo_str)
        assert game_id is not None
        logger.info("[GAME] Created game_id=%s target_word=%s", game_id, target_word or "(none)")

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
    Make one AI guess.  Uses the in-memory chat_history so no DB round-trip is
    needed.  Appends the new user/assistant turns to chat_history in-place.
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


async def _run_single_game_guess_loop(
    client: Any,
    prompt: str,
    game_id: int,
    target_word: str,
    websocket: WebSocket,
    state: dict[str, Any],
    guess_interval_s: float,
) -> None:
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


async def run_room_game(
    config: dict[str, Any],
    audio_queue: asyncio.Queue[bytes | None],
    on_transcript_update: Callable[[str], Awaitable[None]],
    on_ai_guess: Callable[[str, str], Awaitable[None]],
    chat_history: list[dict] | None = None,
) -> None:
    """
    Room-aware variant of the game loop.

    Responsibilities:
    - Consume audio from audio_queue.
    - Stream to Mistral transcription.
    - Call on_transcript_update(transcript) whenever new text arrives.
    - Periodically run the AI guesser on the transcript delta and call
      on_ai_guess(guess, full_transcript) with the result.

    chat_history: optional mutable list shared with the caller.  The loop appends
    new AI turns to it in-place.  Callers (e.g. ws_room) may also append human
    guess events to the same list so the AI sees the full guess history without
    any database round-trips.

    This function does not know about WebSockets or the database; callers
    (e.g. ws_room) are responsible for broadcasting and persistence, and
    for enforcing win logic (human vs AI).
    """
    api_key = os.environ.get("MISTRAL_API_KEY")
    if not api_key:
        logger.error("MISTRAL_API_KEY is not set")
        return

    # Guesser receives only game rules + transcript (from guesser_prompt); never target_word, options, or hints.
    prompt = get_guesser_system_prompt()

    guess_interval_ms = _coerce_guess_interval_ms(config.get("guess_interval_ms"))
    guess_interval_s = guess_interval_ms / 1000
    state: dict[str, Any] = {"transcript": ""}
    logger.info("[ROOM_GUESSER] Interval configured to %sms", guess_interval_ms)

    # Use the caller-supplied list so that external events (e.g. human guesses)
    # appended by ws_room are visible to the guesser loop without any DB query.
    shared_history: list[dict] = chat_history if chat_history is not None else []

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
    Make one AI guess for a room game.  Uses the shared in-memory chat_history so
    no DB round-trip is needed.  Appends the new user/assistant turns in-place,
    safely avoiding overwrites if the caller appended human-guess events during
    the async API call.
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


async def _run_room_guess_loop(
    client: Any,
    prompt: str,
    state: dict[str, Any],
    on_ai_guess: Callable[[str, str], Awaitable[None]],
    chat_history: list[dict],
    guess_interval_s: float,
) -> None:
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


def _coerce_guess_interval_ms(raw_value: Any) -> int:
    try:
        interval_ms = int(raw_value)
        if interval_ms <= 0:
            raise ValueError("interval must be positive")
        return interval_ms
    except (TypeError, ValueError):
        return DEFAULT_GUESS_INTERVAL_MS
