import asyncio
from collections.abc import AsyncIterator
from typing import Protocol, Any


class AiBackend(Protocol):
    async def stream_transcription(
        self,
        audio_queue: asyncio.Queue[bytes | None],
        *,
        context: str,
    ) -> AsyncIterator[Any]:
        ...

    async def guess_word(
        self,
        system_prompt: str,
        transcript_content: str,
        chat_history: list[dict],
    ) -> tuple[str, list[dict]]:
        ...


async def audio_queue_to_stream(
    audio_queue: asyncio.Queue[bytes | None],
) -> AsyncIterator[bytes]:
    """
    Convert an asyncio.Queue of audio chunks (bytes) into an async iterator
    suitable for backends that expect a streaming iterable instead of a queue.
    """
    while True:
        chunk = await audio_queue.get()
        if chunk is None:
            break
        yield chunk

