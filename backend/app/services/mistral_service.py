"""
Thin wrapper around Mistral: real-time transcription stream and chat completion (guesser).
No DB, no FastAPI.
"""
from typing import AsyncIterator

from mistralai import Mistral
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
    )


async def guess_word(
    client: Mistral,
    system_prompt: str,
    transcript: str,
    *,
    model: str = "mistral-small-latest",
    temperature: float = 0.7,
) -> str:
    """
    Call Mistral chat to guess the word from the transcript. Returns the guess string.
    """
    if not transcript.strip():
        return ""
    response = await client.chat.complete_async(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Here is the transcript so far: {transcript}"},
        ],
        temperature=temperature,
    )
    return (response.choices[0].message.content or "").strip()


def get_event_types():
    """Return event types used by transcribe_stream for isinstance checks."""
    return (
        RealtimeTranscriptionSessionCreated,
        TranscriptionStreamTextDelta,
        TranscriptionStreamDone,
        RealtimeTranscriptionError,
        UnknownRealtimeEvent,
    )
