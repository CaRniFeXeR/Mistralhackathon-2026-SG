"""
Game orchestration: consume audio queue, run Mistral transcription and guesser,
persist games and guesses. No HTTP/WS handling beyond sending responses.
"""
import asyncio
import json
import logging
import os
import re
from typing import Any

from fastapi import WebSocket
from mistralai import Mistral

from backend.app.db import repository as db
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

    prompt = config.get("prompt", "You are playing Taboo. Guess the word. Answer with ONLY the word.")
    target_word = config.get("target_word") or ""
    taboo_words = config.get("taboo_words")
    if taboo_words is None:
        taboo_words = []
    taboo_str = json.dumps(taboo_words) if isinstance(taboo_words, list) else str(taboo_words)

    game_id: int | None = None

    state: dict[str, Any] = {"transcript": "", "word_count": 0}
    try:
        game_id = await db.insert_game(target_word=target_word, taboo_words=taboo_str)
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
            row = await db.get_game(game_id)
            if row and row.get("outcome") == "playing":
                await db.update_game_outcome(
                    game_id,
                    outcome=db.OUTCOME_STOPPED,
                    final_transcript=state.get("transcript") or None,
                )


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
        await db.insert_guess(game_id, guess, is_win)
        await _send_if_connected(websocket, {"type": "AI_GUESS", "guess": guess})
        if is_win and game_id:
            await db.update_game_outcome(
                game_id,
                outcome=db.OUTCOME_WON,
                winning_guess=guess,
                final_transcript=transcript,
            )
    except Exception as e:
        logger.error("[GUESSER] Error: %s", e, exc_info=True)
