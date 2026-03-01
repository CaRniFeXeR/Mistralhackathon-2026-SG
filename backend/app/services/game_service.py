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

from backend.app.db.connection import async_session_factory
from backend.app.db import repository as db
from backend.app.db.repository import encode_taboo_words
from backend.app.services import ai_config
from backend.app.services.ai_backend import AiBackend
from backend.app.services.guesser_common import build_guesser_user_message
from backend.app.services.guesser_prompt import get_guesser_system_prompt
from backend.app.services.mistral_service import MistralAiBackend, create_mistral_client
from backend.app.services import vllm_service

logger = logging.getLogger(__name__)

# ── AI backend selection ─────────────────────────────────────────────────────
AI_MODE = ai_config.get_ai_mode()
logger.info("[GAME] AI_MODE=%s", AI_MODE)

if AI_MODE in ("vllm", "hybrid", "hybrid_2"):
    # Fail fast at startup if the vLLM servers aren't reachable rather than
    # discovering the problem during the first game session.
    try:
        check_guesser = AI_MODE == "vllm"
        vllm_service.check_vllm_health(check_guesser=check_guesser)
        logger.info("[GAME] vLLM health check passed.")
    except RuntimeError as _vllm_health_err:
        raise RuntimeError(str(_vllm_health_err)) from None

# WebSocket.CONNECTED value in starlette
WS_CONNECTED = 1
DEFAULT_GUESS_INTERVAL_MS = 1200
# A valid guess is one concept only (1-4 words). Longer guesses do not win via "one word matches".
MAX_GUESS_WORDS = 4


def _create_ai_backend(for_player_transcription: bool = False) -> Any | None:
    """
    Factory for the current AI backend (Mistral API or local vLLM).
    Centralizes AI_MODE selection and, for the API path, client creation.
    """
    if AI_MODE == "vllm":
        return vllm_service.VllmAiBackend()

    client = create_mistral_client(allow_pool=True)
    if client is None:
        return None

    if AI_MODE == "hybrid":
        return HybridAiBackend(client)

    if AI_MODE == "hybrid_2":
        if for_player_transcription:
            # All other human players inputs interface with the API call version
            return MistralAiBackend(client)
        else:
            # The game master input should still interface w/ the local docker VLLM transcriber
            # Guesser model should still be called via API connection.
            return HybridAiBackend(client)

    return MistralAiBackend(client)

class HybridAiBackend:
    def __init__(self, client):
        self._vllm_backend = vllm_service.VllmAiBackend()
        self._mistral_backend = MistralAiBackend(client)

    async def stream_transcription(self, audio_queue, *, context):
        async for event in self._vllm_backend.stream_transcription(audio_queue, context=context):
            yield event

    async def guess_word(self, system_prompt, transcript_content, chat_history):
        return await self._mistral_backend.guess_word(system_prompt, transcript_content, chat_history)


async def _send_if_connected(ws: WebSocket, payload: dict[str, Any]) -> None:
    if ws.client_state.value == WS_CONNECTED:
        await ws.send_json(payload)
    else:
        logger.warning("[GUESSER] WebSocket not connected, dropping message: %s", list(payload.keys()))


async def _cancel_task(task: asyncio.Task[Any] | None) -> None:
    if task is None:
        return
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


def _normalize(s: str) -> str:
    s = s.lower().replace("\n", " ")
    s = re.sub(r'[^\w\s]', '', s)
    return s.strip()


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

    if clean_guess == clean_target:
        return True

    target_tokens = clean_target.split()
    guess_tokens = clean_guess.split()

    # Only one concept (at most MAX_GUESS_WORDS) can win; long lists do not win on 1-of-many matches.
    if len(guess_tokens) > MAX_GUESS_WORDS:
        return False

    def match_plural(w1: str, w2: str) -> bool:
        if w1 == w2: return True
        if w1 + 's' == w2 or w2 + 's' == w1: return True
        if w1 + 'es' == w2 or w2 + 'es' == w1: return True
        return False

    if len(target_tokens) == 1:
        # For single-word targets, check against any word in the guess using plural logic
        for gw in guess_tokens:
            if match_plural(clean_target, gw):
                return True
        return False

    # For multi-word targets, match phrase and allow optional plural
    escaped = re.escape(clean_target)
    return bool(re.search(rf"\b{escaped}(s|es)?\b", clean_guess))


def check_win_for_word(guess: str, target_word: str) -> bool:
    """
    Public helper so other modules (e.g. WebSocket room handler) can reuse
    the same win-checking logic as the legacy single-player game.
    """
    return _check_win(guess, target_word)


def check_win_combined(recent_guesses: list[str], target_word: str) -> bool:
    """
    Check whether any contiguous window of recent guesses, joined with spaces,
    matches a multi-word target (2-3 words).

    For single-word targets this always returns False (use check_win_for_word).
    Callers should pass a scope-appropriate history (e.g., same-user consecutive guesses).
    """
    if not target_word or not recent_guesses:
        return False
    clean_target = _normalize(target_word)
    target_len = len(clean_target.split())
    if target_len < 2 or target_len > 3:
        return False

    cleaned_guesses = []
    for guess in recent_guesses:
        cleaned_guess = _normalize(guess)
        if cleaned_guess:
            cleaned_guesses.append(cleaned_guess)
    if len(cleaned_guesses) < target_len:
        return False

    for start in range(0, len(cleaned_guesses) - target_len + 1):
        combined = " ".join(cleaned_guesses[start : start + target_len])
        if _check_win(combined, target_word):
            return True
    return False


def contains_taboo(transcript: str, taboo_words: list) -> bool:
    """
    Check whether the transcript contains any taboo word or phrase, using the
    same fuzzy, word-boundary-aware matching we use for winning words.

    - Multi-word taboo phrases are matched like target words in _check_win:
      either the whole transcript equals the phrase or it appears as a
      word-bounded substring.
    - Single-word taboo entries are matched as whole words anywhere in the
      transcript (not just when the entire transcript is that word).
    """
    if not transcript or not taboo_words:
        return False

    clean_transcript = _normalize(transcript)

    for word in taboo_words:
        if not isinstance(word, str):
            continue
        clean_word = _normalize(word)
        if not clean_word:
            continue

        tokens = clean_word.split()
        if len(tokens) == 1:
            # Single-word taboo: match as a whole word anywhere in the transcript.
            escaped = re.escape(clean_word)
            if re.search(rf"\b{escaped}\b", clean_transcript):
                return True
        else:
            # Multi-word taboo phrase: reuse the same logic as for winning words.
            if _check_win(clean_transcript, clean_word):
                return True

    return False


def contains_target_word(transcript: str, target_word: str) -> bool:
    """
    Return True if the transcript contains the target word (or phrase), using
    the same normalization and matching as _check_win (e.g. plural-aware for
    single-word targets). Used to detect GM violation when they say the target.
    """
    if not target_word:
        return False
    return _check_win(transcript, target_word)


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
    # In run_game (single player), the user is the 'GM' for transcription purposes
    backend = _create_ai_backend(for_player_transcription=False)
    if backend is None:
        logger.error("[GAME] AI backend could not be created — aborting game run")
        return
    target_word = config.get("target_word") or ""
    taboo_words = config.get("taboo_words") or []
    if not isinstance(taboo_words, list):
        taboo_words = [str(taboo_words)]
    taboo_str = encode_taboo_words([str(w) for w in taboo_words])

    game_id: int | None = None

    guess_interval_ms = _coerce_guess_interval_ms(config.get("guess_interval_ms"))
    guess_interval_s = guess_interval_ms / 1000
    state: dict[str, Any] = {"transcript": "", "taboo_violated": False, "stopped": False}
    logger.info("[GUESSER] Interval configured to %sms (AI_MODE=%s)", guess_interval_ms, AI_MODE)
    try:
        async with async_session_factory() as session:
            async with session.begin():
                game_id = await db.insert_game(
                    session,
                    target_word=target_word,
                    taboo_words=taboo_str,
                )
        assert game_id is not None
        logger.info("[GAME] Created game_id=%s target_word=%s", game_id, target_word or "(none)")

        guess_loop_task = asyncio.create_task(
            _run_single_game_guess_loop_backend(
                backend=backend,
                prompt=prompt,
                game_id=game_id,
                target_word=target_word,
                websocket=websocket,
                state=state,
                guess_interval_s=guess_interval_s,
            )
        )
        try:
            async def _on_text_delta(delta: str) -> None:
                state["transcript"] += delta
                await _send_if_connected(
                    websocket,
                    {"type": "TRANSCRIPT_UPDATE", "transcript": state["transcript"]},
                )
                if contains_taboo(state["transcript"], taboo_words):
                    state["taboo_violated"] = True
                if contains_target_word(state["transcript"], target_word):
                    state["taboo_violated"] = True

            await _consume_transcription_stream(
                backend=backend,
                audio_queue=audio_queue,
                context="GAME",
                on_text_delta=_on_text_delta,
                stop_when=lambda: bool(state.get("taboo_violated") or state.get("stopped")),
            )
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


async def _backend_guess_once(
    backend: AiBackend,
    prompt: str,
    transcript_delta: str,
    chat_history: list[dict],
) -> tuple[str, list[dict]]:
    """
    Call the current AI backend once and update the shared chat_history list
    in-place, returning (guess, updated_history_snapshot).
    """
    if not transcript_delta.strip():
        return "", chat_history

    logger.info(
        "[AI_GUESSER] Firing guess on delta (%s words), history_turns=%d: '%.120s'",
        len(transcript_delta.split()),
        len(chat_history),
        transcript_delta,
    )
    history_snapshot = list(chat_history)
    guess, updated_history = await backend.guess_word(
        system_prompt=prompt,
        transcript_content=transcript_delta,
        chat_history=history_snapshot,
    )
    logger.info("[AI_GUESSER] AI says: '%s'", guess)
    if not guess:
        return "", chat_history

    # Enforce one concept: use only the first MAX_GUESS_WORDS words for win-check and persistence.
    words = guess.strip().split()
    if len(words) > MAX_GUESS_WORDS:
        guess = " ".join(words[:MAX_GUESS_WORDS])

    new_turns = updated_history[len(history_snapshot):]
    if new_turns:
        chat_history.extend(new_turns)
    return guess, chat_history


async def _single_game_guess_step(
    backend: AiBackend,
    prompt: str,
    full_transcript: str,
    llm_guesses: list[str],
    game_id: int,
    target_word: str,
    websocket: WebSocket,
) -> bool:
    """
    Make one AI guess for the legacy single-player game and persist it.
    Returns True if this guess wins the game.
    """
    structured_user_message = build_guesser_user_message(
        full_transcript, llm_guesses, []
    )
    guess, _ = await _backend_guess_once(
        backend=backend,
        prompt=prompt,
        transcript_delta=structured_user_message,
        chat_history=[],
    )
    if not guess:
        return False

    llm_guesses.append(guess)
    is_win = _check_win(guess, target_word)
    try:
        async with async_session_factory() as session:
            async with session.begin():
                await db.insert_guess(
                    session,
                    guess_text=guess,
                    is_win=is_win,
                    game_id=game_id,
                )
                if is_win:
                    await db.update_game_outcome(
                        session,
                        game_id,
                        outcome=db.OUTCOME_WON,
                        winning_guess=guess,
                        final_transcript=full_transcript,
                    )
    except Exception as exc:
        logger.error("[GUESSER] Error persisting guess: %s", exc, exc_info=True)
        return False

    await _send_if_connected(websocket, {"type": "AI_GUESS", "guess": guess})
    return is_win


async def _run_single_game_guess_loop_backend(
    backend: AiBackend,
    prompt: str,
    game_id: int,
    target_word: str,
    websocket: WebSocket,
    state: dict[str, Any],
    guess_interval_s: float,
) -> None:
    """Backend-agnostic guess loop for the legacy single-player game."""
    llm_guesses: list[str] = []
    last_transcript_pos: int = 0
    while True:
        if state.get("taboo_violated") or state.get("stopped"):
            return
        full_transcript = str(state.get("transcript") or "").strip()
        delta = full_transcript[last_transcript_pos:]
        if delta.strip() and _word_count(full_transcript) >= 3:
            is_win = await _single_game_guess_step(
                backend=backend,
                prompt=prompt,
                full_transcript=full_transcript,
                llm_guesses=llm_guesses,
                game_id=game_id,
                target_word=target_word,
                websocket=websocket,
            )
            last_transcript_pos = len(full_transcript)
            if is_win:
                state["stopped"] = True
                return
        await asyncio.sleep(guess_interval_s)


def _build_full_prompt(system_prompt: str, structured_user_message: str) -> str:
    """Build the full prompt (system + single user message) for logging. Never include target_word or taboo_words."""
    return f"[SYSTEM]\n{system_prompt}\n\n[USER]\n{structured_user_message}"


def _other_guesses_to_tuples(
    other_guesses: list[dict[str, str]] | None,
) -> list[tuple[str, str]]:
    """Convert list of {display_name, guess} dicts to list of (display_name, guess) for build_guesser_user_message."""
    if not other_guesses:
        return []
    return [
        (str(o.get("display_name", "")), str(o.get("guess", "")))
        for o in other_guesses
    ]


async def run_room_game(
    config: dict[str, Any],
    audio_queue: asyncio.Queue[bytes | None],
    on_transcript_update: Callable[[str], Awaitable[None]],
    on_ai_guess: Callable[..., Awaitable[None]],
    llm_guesses: list[str] | None = None,
    other_guesses: list[dict[str, str]] | None = None,
) -> None:
    """
    Room-aware variant of the game loop (supports both API and vLLM modes).

    Responsibilities:
    - Consume audio from audio_queue.
    - Stream to transcription backend (Mistral API or local vLLM).
    - Call on_transcript_update(transcript) whenever new text arrives.
    - Periodically run the AI guesser with structured prompt (transcript, LLM guesses, other players' guesses)
    - Call on_ai_guess(guess, full_transcript, prompt_input=..., full_prompt=..., ground_truth=...) with the result.

    llm_guesses: optional mutable list of AI guesses so far. The loop appends each new AI guess in-place.
    other_guesses: optional mutable list of {"display_name": str, "guess": str}. Callers (e.g. ws_room) append
    human guesses so the AI sees them. Target word and taboo words are never passed to the guesser.

    This function does not know about WebSockets or the database; callers
    (e.g. ws_room) are responsible for broadcasting and persistence, and
    for enforcing win logic (human vs AI).
    """
    prompt = get_guesser_system_prompt()
    # run_room_game is called for the GM's connection
    backend = _create_ai_backend(for_player_transcription=False)
    if backend is None:
        logger.error("[ROOM_GAME] AI backend could not be created — aborting room game")
        return

    guess_interval_ms = _coerce_guess_interval_ms(config.get("guess_interval_ms"))
    guess_interval_s = guess_interval_ms / 1000
    state: dict[str, Any] = {"transcript": ""}
    ground_truth: str = str(config.get("target_word") or "")
    logger.info("[ROOM_GUESSER] Interval configured to %sms (AI_MODE=%s)", guess_interval_ms, AI_MODE)

    shared_llm_guesses: list[str] = llm_guesses if llm_guesses is not None else []
    shared_other_guesses: list[dict[str, str]] = other_guesses if other_guesses is not None else []

    guess_loop_task = asyncio.create_task(
        _run_room_guess_loop_backend(
            backend=backend,
            prompt=prompt,
            state=state,
            on_ai_guess=on_ai_guess,
            llm_guesses=shared_llm_guesses,
            other_guesses=shared_other_guesses,
            guess_interval_s=guess_interval_s,
            ground_truth=ground_truth,
        )
    )
    try:
        async def _on_text_delta(delta: str) -> None:
            state["transcript"] += delta
            await on_transcript_update(state["transcript"])

        await _consume_transcription_stream(
            backend=backend,
            audio_queue=audio_queue,
            context="ROOM_GAME",
            on_text_delta=_on_text_delta,
        )
    finally:
        await _cancel_task(guess_loop_task)


async def _room_game_guess_step(
    backend: AiBackend,
    prompt: str,
    full_transcript: str,
    llm_guesses: list[str],
    other_guesses: list[dict[str, str]],
    on_ai_guess: Callable[..., Awaitable[None]],
    ground_truth: str,
) -> None:
    """
    Make one AI guess for a room game. Builds structured user message from
    transcript, llm_guesses, other_guesses; appends new guess to llm_guesses;
    calls on_ai_guess with result and full_prompt for logging.
    """
    other_tuples = _other_guesses_to_tuples(other_guesses)
    structured_user_message = build_guesser_user_message(
        full_transcript, llm_guesses, other_tuples
    )
    full_prompt = _build_full_prompt(prompt, structured_user_message)
    guess, _ = await _backend_guess_once(
        backend=backend,
        prompt=prompt,
        transcript_delta=structured_user_message,
        chat_history=[],
    )
    if not guess:
        return
    llm_guesses.append(guess)
    await on_ai_guess(
        guess,
        full_transcript,
        prompt_input=structured_user_message,
        full_prompt=full_prompt,
        ground_truth=ground_truth,
    )


async def _run_room_guess_loop_backend(
    backend: AiBackend,
    prompt: str,
    state: dict[str, Any],
    on_ai_guess: Callable[..., Awaitable[None]],
    llm_guesses: list[str],
    other_guesses: list[dict[str, str]],
    guess_interval_s: float,
    ground_truth: str = "",
) -> None:
    """Backend-agnostic guess loop for room games."""
    last_transcript_pos: int = 0
    while True:
        full_transcript = str(state.get("transcript") or "").strip()
        delta = full_transcript[last_transcript_pos:]
        if delta.strip() and _word_count(full_transcript) >= 3:
            await _room_game_guess_step(
                backend=backend,
                prompt=prompt,
                full_transcript=full_transcript,
                llm_guesses=llm_guesses,
                other_guesses=other_guesses,
                on_ai_guess=on_ai_guess,
                ground_truth=ground_truth,
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
    # All other human players inputs interface with the API call version in hybrid_2
    backend = _create_ai_backend(for_player_transcription=True)
    if backend is None:
        logger.error("AI backend could not be created — cannot transcribe player speech")
        return ""

    full_transcript = ""

    async def _on_delta(partial: str) -> None:
        nonlocal full_transcript
        full_transcript += partial
        await on_transcript_delta(full_transcript)

    await _consume_transcription_stream(
        backend=backend,
        audio_queue=audio_queue,
        context="PLAYER_TRANSCRIBE",
        on_text_delta=_on_delta,
    )

    return full_transcript.strip()


def _coerce_guess_interval_ms(raw_value: Any) -> int:
    try:
        interval_ms = int(raw_value)
        if interval_ms <= 0:
            raise ValueError("interval must be positive")
        return interval_ms
    except (TypeError, ValueError):
        return DEFAULT_GUESS_INTERVAL_MS


async def _consume_transcription_stream(
    backend: AiBackend,
    audio_queue: asyncio.Queue[bytes | None],
    *,
    context: str,
    on_text_delta: Callable[[str], Awaitable[None]],
    stop_when: Callable[[], bool] | None = None,
) -> None:
    """
    Unified helper to consume a transcription stream from the current AI backend
    and invoke callbacks on each text delta. Works for both Mistral and vLLM
    synthetic events by inspecting event attributes instead of exact types.
    """
    try:
        async for event in backend.stream_transcription(audio_queue, context=context):
            if stop_when is not None and stop_when():
                break

            text = getattr(event, "text", None)
            if isinstance(text, str) and text:
                await on_text_delta(text)
                if stop_when is not None and stop_when():
                    break
                continue

            message = getattr(event, "message", None)
            if isinstance(message, str) and message:
                logger.error("[%s] Transcription error: %s", context, message)
                continue

            # For session created / done / unknown events we just log at debug level.
            logger.debug("[%s] Transcription event: %s", context, type(event).__name__)
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        logger.error("[%s] Transcription stream error: %s", context, exc, exc_info=True)
