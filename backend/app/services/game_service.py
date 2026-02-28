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


async def _send_if_connected(ws: WebSocket, payload: dict[str, Any]) -> None:
    if ws.client_state.value == WS_CONNECTED:
        await ws.send_json(payload)
    else:
        logger.warning("[GUESSER] WebSocket not connected, dropping message: %s", list(payload.keys()))


def _normalize(s: str) -> str:
    return s.lower().replace("\n", " ").strip()


def _check_win(guess: str, target_word: str) -> bool:
    if not target_word:
        return False
    clean_guess = _normalize(guess)
    clean_target = _normalize(target_word)
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

    state: dict[str, Any] = {"transcript": "", "word_count": 0}
    try:
        async with async_session_factory() as session:
            async with session.begin():
                game_id = await db.insert_game(session, target_word=target_word, taboo_words=taboo_str)
        logger.info("[GAME] Created game_id=%s target_word=%s", game_id, target_word or "(none)")

        client = Mistral(api_key=api_key)

        async def audio_stream():
            while True:
                chunk = await audio_queue.get()
                if chunk is None:
                    break
                yield chunk

        async for event in transcribe_stream(client, audio_stream()):
            if isinstance(event, RealtimeTranscriptionSessionCreated):
                logger.info("[MISTRAL] Realtime transcription session created")
            elif isinstance(event, TranscriptionStreamTextDelta):
                state["transcript"] += event.text
                await _send_if_connected(
                    websocket,
                    {"type": "TRANSCRIPT_UPDATE", "transcript": state["transcript"]},
                )
                words = state["transcript"].split()
                new_words = len(words) - state["word_count"]
                if new_words >= 3:
                    state["word_count"] = len(words)
                    transcript_snapshot = state["transcript"]
                    asyncio.create_task(
                        _guesser_task(client, prompt, transcript_snapshot, game_id, target_word, websocket)
                    )
            elif isinstance(event, TranscriptionStreamDone):
                logger.info("[MISTRAL] Transcription stream done")
            elif isinstance(event, RealtimeTranscriptionError):
                logger.error("[MISTRAL] RealtimeTranscriptionError: %s", event)
            elif isinstance(event, UnknownRealtimeEvent):
                logger.warning("[MISTRAL] UnknownRealtimeEvent: %s", event)

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
    transcript: str,
    game_id: int,
    target_word: str,
    websocket: WebSocket,
) -> None:
    if not transcript.strip():
        return
    logger.info("[GUESSER] Firing guess on transcript (%s words): '%s...'", len(transcript.split()), transcript[:120])
    try:
        guess = await guess_word(client, prompt, transcript)
        logger.info("[GUESSER] AI says: '%s'", guess)
        if not guess:
            return
        is_win = _check_win(guess, target_word)
        async with async_session_factory() as session:
            async with session.begin():
                await db.insert_guess(session, game_id, guess, is_win)
                if is_win:
                    await db.update_game_outcome(
                        session,
                        game_id,
                        outcome=db.OUTCOME_WON,
                        winning_guess=guess,
                        final_transcript=transcript,
                    )
        await _send_if_connected(websocket, {"type": "AI_GUESS", "guess": guess})
    except Exception as e:
        logger.error("[GUESSER] Error: %s", e, exc_info=True)


async def run_room_game(
    config: dict[str, Any],
    audio_queue: asyncio.Queue[bytes | None],
    on_transcript_update: Callable[[str], Awaitable[None]],
    on_ai_guess: Callable[[str, str], Awaitable[None]],
) -> None:
    """
    Room-aware variant of the game loop.

    Responsibilities:
    - Consume audio from audio_queue.
    - Stream to Mistral transcription.
    - Call on_transcript_update(transcript) whenever new text arrives.
    - Periodically run the AI guesser on the transcript and call
      on_ai_guess(guess, transcript_snapshot) with the result.

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

    state: dict[str, Any] = {"transcript": "", "word_count": 0}

    client = Mistral(api_key=api_key)

    async def audio_stream():
        while True:
            chunk = await audio_queue.get()
            if chunk is None:
                break
            yield chunk

    try:
        async for event in transcribe_stream(client, audio_stream()):
            if isinstance(event, RealtimeTranscriptionSessionCreated):
                logger.info("[MISTRAL] Realtime transcription session created (room)")
            elif isinstance(event, TranscriptionStreamTextDelta):
                state["transcript"] += event.text
                await on_transcript_update(state["transcript"])

                words = state["transcript"].split()
                new_words = len(words) - state["word_count"]
                if new_words >= 3:
                    state["word_count"] = len(words)
                    transcript_snapshot = state["transcript"]
                    asyncio.create_task(
                        _room_ai_guesser_task(
                            client=client,
                            prompt=prompt,
                            transcript=transcript_snapshot,
                            on_ai_guess=on_ai_guess,
                        )
                    )
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


async def _room_ai_guesser_task(
    client: Any,
    prompt: str,
    transcript: str,
    on_ai_guess: Callable[[str, str], Awaitable[None]],
) -> None:
    if not transcript.strip():
        return
    logger.info(
        "[ROOM_GUESSER] Firing guess on transcript (%s words): '%s...'",
        len(transcript.split()),
        transcript[:120],
    )
    try:
        guess = await guess_word(client, prompt, transcript)
        logger.info("[ROOM_GUESSER] AI says: '%s'", guess)
        if not guess:
            return
        await on_ai_guess(guess, transcript)
    except Exception as exc:
        logger.error("[ROOM_GUESSER] Error: %s", exc, exc_info=True)
