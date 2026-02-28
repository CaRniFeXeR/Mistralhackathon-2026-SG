"""
Buffered writer for AI guess logs. Enqueue is non-blocking (in-memory only);
a background task flushes to the DB periodically so the game loop never awaits DB.
"""
import asyncio
import logging
from typing import Any

from backend.app.db.connection import db_transaction
from backend.app.db import repository as db

logger = logging.getLogger(__name__)

_FLUSH_INTERVAL_S = 5.0
_FLUSH_BATCH_SIZE = 50

_buffer: list[dict[str, Any]] = []
_lock = asyncio.Lock()
_flush_task: asyncio.Task[None] | None = None


def enqueue_ai_guess_log(
    room_game_id: int | None,
    prompt_input: str,
    llm_output: str,
    ground_truth: str,
    full_prompt: str | None = None,
) -> None:
    """
    Append one AI guess log to the in-memory buffer. Non-blocking; no DB write.
    If room_game_id is None, the entry is skipped (no orphan rows).
    """
    if room_game_id is None:
        return
    entry = {
        "room_game_id": room_game_id,
        "prompt_input": prompt_input,
        "llm_output": llm_output,
        "ground_truth": ground_truth,
        "full_prompt": full_prompt,
    }
    _buffer.append(entry)


async def _flush() -> None:
    """Take a snapshot of the buffer, clear it, then batch insert (under lock)."""
    async with _lock:
        if not _buffer:
            return
        snapshot = _buffer.copy()
        _buffer.clear()
    try:
        async with db_transaction() as session:
            await db.insert_ai_guess_log_batch(session, snapshot)
        logger.debug("[AI_GUESS_LOG] Flushed %d entries", len(snapshot))
    except Exception as exc:
        logger.error("[AI_GUESS_LOG] Flush failed: %s", exc, exc_info=True)
        async with _lock:
            _buffer.extend(snapshot)


async def _run_flush_loop() -> None:
    """Background loop: flush every FLUSH_INTERVAL_S or when buffer >= FLUSH_BATCH_SIZE."""
    try:
        while True:
            await asyncio.sleep(_FLUSH_INTERVAL_S)
            async with _lock:
                n = len(_buffer)
            if n >= _FLUSH_BATCH_SIZE or n > 0:
                await _flush()
    except asyncio.CancelledError:
        await _flush()
        raise


def start_flush_task() -> asyncio.Task[None]:
    """Start the background flush task. Call from FastAPI lifespan."""
    global _flush_task
    if _flush_task is not None:
        return _flush_task
    _flush_task = asyncio.create_task(_run_flush_loop())
    logger.info("[AI_GUESS_LOG] Buffer flush task started")
    return _flush_task


async def stop_flush_task() -> None:
    """Cancel the flush task and do one final flush. Call on shutdown."""
    global _flush_task
    if _flush_task is None:
        return
    _flush_task.cancel()
    try:
        await _flush_task
    except asyncio.CancelledError:
        pass
    _flush_task = None
    logger.info("[AI_GUESS_LOG] Buffer flush task stopped")
