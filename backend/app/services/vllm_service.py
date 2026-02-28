"""
vLLM backend service — mirrors the interface of mistral_service.py but routes
to locally-running vLLM model servers instead of Mistral's hosted APIs.

Transcriber:  ws://localhost:8100/v1/realtime  (Voxtral-Mini-4B-Realtime-2602)
Guesser:      http://localhost:8101            (Mistral-Small-3.2-24B-Instruct-2506, AWQ)

The events yielded by transcribe_stream_vllm() are synthetic objects whose
attributes match those consumed by game_service.py, so game_service.py requires
only a branch on AI_MODE — no changes to its event-handling logic.
"""
import asyncio
import base64
import json
import logging
import os
import time
from typing import AsyncIterator, Awaitable, Callable

import httpx
import websockets

from backend.app.services.ai_backend import AiBackend
from backend.app.services.guesser_common import (
    build_guesser_messages,
    update_chat_history,
)

logger = logging.getLogger(__name__)

# ── Default URLs (overridden by env vars set by run_app.sh) ─────────────────
_DEFAULT_TRANSCRIBER_WS = "ws://localhost:8100"
_DEFAULT_GUESSER_HTTP = "http://localhost:8101"

TRANSCRIBER_MODEL = "mistralai/Voxtral-Mini-4B-Realtime-2602"
GUESSER_MODEL = "mistralai/Mistral-Small-3.2-24B-Instruct-2506"

# Audio streaming constants
_CHUNK_BYTES = 4096          # 4 KB per WebSocket audio message
_AUDIO_SEND_INTERVAL = 0.05  # seconds between audio sends (20 msgs/sec)


# ── Synthetic event types ────────────────────────────────────────────────────
# These match the attribute interface expected by game_service.py so the caller
# can do isinstance(event, TranscriptionStreamTextDelta) etc.

class _SessionCreated:
    """Equivalent to mistralai RealtimeTranscriptionSessionCreated."""
    pass


class _TextDelta:
    """Equivalent to mistralai TranscriptionStreamTextDelta."""
    def __init__(self, text: str):
        self.text = text


class _StreamDone:
    """Equivalent to mistralai TranscriptionStreamDone."""
    pass


class _StreamError:
    """Equivalent to mistralai RealtimeTranscriptionError."""
    def __init__(self, message: str):
        self.message = message


class _UnknownEvent:
    """Equivalent to mistralai UnknownRealtimeEvent."""
    def __init__(self, data: dict):
        self.data = data


def get_event_types_vllm() -> tuple:
    """Return the synthetic event type tuple (same ordering as mistral_service.get_event_types)."""
    return (
        _SessionCreated,
        _TextDelta,
        _StreamDone,
        _StreamError,
        _UnknownEvent,
    )


# ── Health check ─────────────────────────────────────────────────────────────

def check_vllm_health(
    *,
    transcriber_base_url: str | None = None,
    guesser_base_url: str | None = None,
    check_guesser: bool = True,
) -> None:
    """
    Synchronously verify that vLLM servers respond on /health.
    """
    import urllib.request
    import urllib.error

    checks = [
        (
            (transcriber_base_url or os.environ.get("VLLM_TRANSCRIBER_URL", _DEFAULT_TRANSCRIBER_WS))
            .replace("ws://", "http://")
            .rstrip("/") + "/health",
            "Transcriber",
            8100,
        )
    ]
    
    if check_guesser:
        checks.append(
            (
                (guesser_base_url or os.environ.get("VLLM_GUESSER_URL", _DEFAULT_GUESSER_HTTP))
                .rstrip("/") + "/health",
                "Guesser",
                8101,
            )
        )

    failed = []
    for url, name, port in checks:
        try:
            with urllib.request.urlopen(url, timeout=3) as resp:
                if resp.status != 200:
                    failed.append((name, port))
        except Exception:
            failed.append((name, port))

    if failed:
        names = ", ".join(f"{n} (:{p})" for n, p in failed)
        raise RuntimeError(
            f"[VLLM] The following model server(s) are not reachable: {names}.\n"
            "  Start them first with:  ./run_vllm_models.sh\n"
            "  Then restart the app:   ./run_app.sh --ai-mode vllm"
        )


# ── Transcription ────────────────────────────────────────────────────────────

async def transcribe_stream_vllm(
    audio_queue: asyncio.Queue,
    *,
    transcriber_base_url: str | None = None,
    model: str = TRANSCRIBER_MODEL,
) -> AsyncIterator:
    """
    Stream audio from audio_queue to a local vLLM Voxtral Realtime server and
    yield synthetic transcription events compatible with game_service.py.

    Protocol (vLLM /v1/realtime WebSocket):
      → session.update            — set the model
      → input_audio_buffer.append — base64 PCM16 audio chunks
      → input_audio_buffer.commit (final=True) — signal end of stream
      ← transcription.delta       — incremental transcript text
      ← transcription.done        — stream complete
    """
    base_url = transcriber_base_url or os.environ.get(
        "VLLM_TRANSCRIBER_URL", _DEFAULT_TRANSCRIBER_WS
    )
    ws_url = base_url.rstrip("/") + "/v1/realtime"

    logger.info("[VLLM_TRANSCRIBE] Connecting to %s", ws_url)

    try:
        async with websockets.connect(ws_url) as ws:
            # Wait for the initial session greeting from the server.
            try:
                greeting = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
                logger.info("[VLLM_TRANSCRIBE] Server greeting: %s", greeting.get("type"))
            except asyncio.TimeoutError:
                logger.warning("[VLLM_TRANSCRIBE] No greeting received within 10s; continuing.")

            yield _SessionCreated()

            # Tell the server which model to use.
            await ws.send(json.dumps({"type": "session.update", "model": model}))

            # Signal start of audio stream.
            await ws.send(json.dumps({"type": "input_audio_buffer.commit"}))

            # ── Audio sender coroutine ────────────────────────────────────
            async def _send_audio() -> None:
                buffer = bytearray()
                while True:
                    try:
                        chunk = await asyncio.wait_for(audio_queue.get(), timeout=0.1)
                    except asyncio.TimeoutError:
                        # Flush partial buffer if any data is waiting.
                        if buffer:
                            encoded = base64.b64encode(bytes(buffer)).decode()
                            await ws.send(json.dumps({
                                "type": "input_audio_buffer.append",
                                "audio": encoded,
                            }))
                            buffer.clear()
                        continue

                    if chunk is None:
                        # Flush remaining buffer.
                        if buffer:
                            encoded = base64.b64encode(bytes(buffer)).decode()
                            await ws.send(json.dumps({
                                "type": "input_audio_buffer.append",
                                "audio": encoded,
                            }))
                            buffer.clear()
                        # Signal end of audio.
                        await ws.send(json.dumps({
                            "type": "input_audio_buffer.commit",
                            "final": True,
                        }))
                        logger.info("[VLLM_TRANSCRIBE] Audio stream ended, sent final commit.")
                        return

                    buffer.extend(chunk)
                    if len(buffer) >= _CHUNK_BYTES:
                        encoded = base64.b64encode(bytes(buffer)).decode()
                        await ws.send(json.dumps({
                            "type": "input_audio_buffer.append",
                            "audio": encoded,
                        }))
                        buffer.clear()
                        await asyncio.sleep(_AUDIO_SEND_INTERVAL)

            send_task = asyncio.create_task(_send_audio())

            # ── Receive transcription events ──────────────────────────────
            try:
                async for raw in ws:
                    try:
                        msg = json.loads(raw)
                    except json.JSONDecodeError:
                        logger.warning("[VLLM_TRANSCRIBE] Non-JSON message: %s", raw[:200])
                        continue

                    msg_type = msg.get("type", "")
                    if msg_type == "transcription.delta":
                        delta = msg.get("delta", "")
                        if delta:
                            yield _TextDelta(delta)
                    elif msg_type == "transcription.done":
                        logger.info("[VLLM_TRANSCRIBE] Transcription done.")
                        yield _StreamDone()
                        break
                    elif msg_type in ("error", "session.error"):
                        err_msg = msg.get("message") or str(msg)
                        logger.error("[VLLM_TRANSCRIBE] Error from server: %s", err_msg)
                        yield _StreamError(err_msg)
                        break
                    elif msg_type in ("session.created", "session.updated"):
                        logger.debug("[VLLM_TRANSCRIBE] Session event: %s", msg_type)
                    else:
                        logger.debug("[VLLM_TRANSCRIBE] Unknown event type: %s", msg_type)
                        yield _UnknownEvent(msg)
            finally:
                send_task.cancel()
                try:
                    await send_task
                except asyncio.CancelledError:
                    pass

    except websockets.exceptions.WebSocketException as exc:
        logger.error("[VLLM_TRANSCRIBE] WebSocket error: %s", exc, exc_info=True)
        yield _StreamError(str(exc))
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        logger.error("[VLLM_TRANSCRIBE] Unexpected error: %s", exc, exc_info=True)
        yield _StreamError(str(exc))


# ── Chat / Guesser ───────────────────────────────────────────────────────────

async def guess_word_vllm(
    system_prompt: str,
    transcript_content: str,
    chat_history: list[dict[str, str]] | None = None,
    *,
    guesser_base_url: str | None = None,
    model: str = GUESSER_MODEL,
    temperature: float = 0.7,
) -> tuple[str, list[dict]]:
    """
    Call the local vLLM guesser via OpenAI-compatible /v1/chat/completions.

    Same signature and return type as mistral_service.guess_word so callers need
    only swap the function reference.

    Returns (guess, updated_chat_history).
    """
    if not transcript_content.strip():
        return "", list(chat_history or [])

    base_url = guesser_base_url or os.environ.get(
        "VLLM_GUESSER_URL", _DEFAULT_GUESSER_HTTP
    )
    url = base_url.rstrip("/") + "/v1/chat/completions"

    history, messages, user_content = build_guesser_messages(
        system_prompt=system_prompt,
        transcript_content=transcript_content,
        chat_history=chat_history,
    )

    logger.info(
        "[VLLM_GUESSER_INPUT] history_turns=%d user_message=%.200s",
        len(history),
        user_content,
    )

    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": 64,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()

    raw = data["choices"][0]["message"]["content"]
    guess = (raw or "").strip()

    logger.info("[VLLM_GUESSER_OUTPUT] %s", guess)

    updated_history = update_chat_history(history, user_content, guess)
    return guess, updated_history


class VllmAiBackend:
    """
    AiBackend implementation backed by the local vLLM services.
    """

    async def stream_transcription(
        self,
        audio_queue: asyncio.Queue[bytes | None],
        *,
        context: str,
    ):
        async for event in transcribe_stream_vllm(audio_queue, model=TRANSCRIBER_MODEL):
            yield event

    async def guess_word(
        self,
        system_prompt: str,
        transcript_content: str,
        chat_history: list[dict[str, str]],
    ) -> tuple[str, list[dict[str, str]]]:
        guess, updated_history = await guess_word_vllm(
            system_prompt, transcript_content, chat_history
        )
        return guess, updated_history

