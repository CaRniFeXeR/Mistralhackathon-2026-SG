"""
Thin wrapper around Mistral: real-time transcription stream and chat completion (guesser).
No DB, no FastAPI.
"""
import asyncio
import logging
from typing import AsyncIterator

from mistralai import Mistral

from backend.app.services.ai_backend import AiBackend, audio_queue_to_stream

logger = logging.getLogger(__name__)
from mistralai.models import (
    AudioFormat,
    RealtimeTranscriptionError,
    RealtimeTranscriptionSessionCreated,
    TranscriptionStreamDone,
    TranscriptionStreamTextDelta,
)
from mistralai.extra.realtime import UnknownRealtimeEvent


def transcribe_stream(
    client: Mistral,
    audio_stream: AsyncIterator[bytes],
    *,
    model: str = "voxtral-mini-transcribe-realtime-2602",
    sample_rate: int = 16000,
):
    """
    Stream audio to Mistral real-time transcription. Yields events:
    RealtimeTranscriptionSessionCreated, TranscriptionStreamTextDelta,
    TranscriptionStreamDone, RealtimeTranscriptionError, UnknownRealtimeEvent.
    """
    audio_format = AudioFormat(encoding="pcm_s16le", sample_rate=sample_rate)
    return client.audio.realtime.transcribe_stream(
        audio_stream=audio_stream,
        model=model,
        audio_format=audio_format,
        target_streaming_delay_ms=240,
    )


async def guess_word(
    client: Mistral,
    system_prompt: str,
    transcript_content: str,
    chat_history: list[dict] | None = None,
    *,
    model: str = "mistral-small-latest",
    temperature: float = 0.7,
) -> tuple[str, list[dict]]:
    """
    Call Mistral chat to guess the word from transcript content.

    transcript_content: full transcript on the first call; only the delta (new text
    since the last call) on subsequent calls—keeps token usage O(n) not O(n²).
    chat_history: previous user/assistant turns (system prompt is never stored here).

    Returns (guess, updated_chat_history).  The updated history appends two new
    entries—the user turn and the assistant turn—so the caller can pass it back
    unchanged on the next call.
    """
    if not transcript_content.strip():
        return "", list(chat_history or [])

    history = list(chat_history or [])
    label = "Transcript so far" if not history else "New clues added"
    user_content = f"{label}: {transcript_content}"

    messages = [
        {"role": "system", "content": system_prompt},
        *history,
        {"role": "user", "content": user_content},
    ]

    logger.info(
        "[AI_GUESSER_INPUT] history_turns=%d user_message=%.200s",
        len(history),
        user_content,
    )
    response = await client.chat.complete_async(
        model=model,
        messages=messages,
        temperature=temperature,
    )
    raw = response.choices[0].message.content
    if isinstance(raw, str):
        text = raw
    else:
        text = "".join(getattr(chunk, "text", str(chunk)) for chunk in (raw or []))

    guess = text.strip()
    logger.info("[AI_GUESSER_OUTPUT] %s", guess)

    updated_history = history + [
        {"role": "user", "content": user_content},
        {"role": "assistant", "content": guess},
    ]
    return guess, updated_history


def get_event_types():
    """Return event types used by transcribe_stream for isinstance checks."""
    return (
        RealtimeTranscriptionSessionCreated,
        TranscriptionStreamTextDelta,
        TranscriptionStreamDone,
        RealtimeTranscriptionError,
        UnknownRealtimeEvent,
    )


class MistralAiBackend:
    """
    AiBackend implementation backed by the Mistral SDK.
    """

    def __init__(self, client: Mistral):
        self._client = client

    async def stream_transcription(
        self,
        audio_queue: asyncio.Queue[bytes | None],
        *,
        context: str,
    ):
        audio_stream = audio_queue_to_stream(audio_queue)
        async for event in transcribe_stream(self._client, audio_stream):
            yield event

    async def guess_word(
        self,
        system_prompt: str,
        transcript_content: str,
        chat_history: list[dict],
    ) -> tuple[str, list[dict]]:
        guess, updated_history = await guess_word(
            self._client, system_prompt, transcript_content, chat_history
        )
        return guess, updated_history

