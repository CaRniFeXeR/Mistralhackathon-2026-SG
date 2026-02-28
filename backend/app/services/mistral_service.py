"""
Thin wrapper around Mistral: real-time transcription stream and chat completion (guesser).
No DB, no FastAPI.
"""
import logging
from typing import AsyncIterator

from mistralai import Mistral

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
        target_streaming_delay_ms=240
    )


def _format_previous_guesses(previous_guesses: list[tuple[str, str | None]]) -> str:
    """Format (guess_text, source) list for the user message."""
    if not previous_guesses:
        return ""
    parts = []
    for text, source in previous_guesses:
        if source:
            parts.append(f"{text} ({source})")
        else:
            parts.append(text)
    return "Words already guessed—do not repeat any of these: " + ", ".join(parts) + ".\n\n"


async def guess_word(
    client: Mistral,
    system_prompt: str,
    transcript: str,
    previous_guesses: list[tuple[str, str | None]] | None = None,
    *,
    model: str = "mistral-small-latest",
    temperature: float = 0.7,
) -> str:
    """
    Call Mistral chat to guess the word from the transcript. Returns the guess string.
    Open-ended: no target word or options are passed to the model.
    previous_guesses: optional list of (guess_text, source) so the model avoids repeating them.
    """
    if not transcript.strip():
        return ""
    prev_block = _format_previous_guesses(previous_guesses or [])
    user_content = prev_block + f"Here is the transcript so far: {transcript}"
    # Log full input so we can verify no target word leakage (system + user only).
    logger.info(
        "[AI_GUESSER_INPUT] system_prompt=%s --- user_message=%s",
        system_prompt,
        user_content,
    )
    response = await client.chat.complete_async(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        temperature=temperature,
    )
    raw = response.choices[0].message.content
    if isinstance(raw, str):
        text = raw
    else:
        text = "".join(getattr(chunk, "text", str(chunk)) for chunk in (raw or []))

    logger.info("[AI_GUESSER_OUTPUT] %s", text.strip())
    return text.strip()


def get_event_types():
    """Return event types used by transcribe_stream for isinstance checks."""
    return (
        RealtimeTranscriptionSessionCreated,
        TranscriptionStreamTextDelta,
        TranscriptionStreamDone,
        RealtimeTranscriptionError,
        UnknownRealtimeEvent,
    )
