import logging

from fastapi import WebSocket


logger = logging.getLogger(__name__)


async def close_with_reason(
    websocket: WebSocket,
    *,
    code: int,
    reason: str,
    log_message: str,
) -> None:
    """
    Centralized helper for closing a WebSocket with a log message.
    """
    logger.error(log_message)
    await websocket.close(code=code, reason=reason)

