"""
WebSocket endpoint /ws/game: config validation and delegation to game_service.
No business logic, no Mistral, no DB.
"""
import asyncio
import json
import logging
import os

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.app.services import game_service

router = APIRouter()
logger = logging.getLogger(__name__)

PROMPT_MAX_LENGTH = 2000
DEFAULT_GUESS_INTERVAL_MS = 200


def _validate_config(data: dict) -> tuple[bool, str]:
    """Validate config. Returns (ok, error_message)."""
    if not isinstance(data, dict):
        return False, "Configuration must be a JSON object"
    prompt = data.get("prompt")
    if prompt is None:
        return False, "Missing 'prompt'"
    if not isinstance(prompt, str):
        return False, "'prompt' must be a string"
    if len(prompt) > PROMPT_MAX_LENGTH:
        return False, f"'prompt' must be at most {PROMPT_MAX_LENGTH} characters"
    target_word = data.get("target_word")
    if target_word is not None and not isinstance(target_word, str):
        return False, "'target_word' must be a string"
    taboo_words = data.get("taboo_words")
    if taboo_words is not None and not isinstance(taboo_words, list):
        return False, "'taboo_words' must be a list"
    guess_interval_ms = data.get("guess_interval_ms")
    if guess_interval_ms is not None:
        if isinstance(guess_interval_ms, bool) or not isinstance(guess_interval_ms, int):
            return False, "'guess_interval_ms' must be an integer"
        if guess_interval_ms <= 0:
            return False, "'guess_interval_ms' must be > 0"
    return True, ""


@router.websocket("/game")
async def websocket_game_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    logger.info("New WebSocket connection to /ws/game")

    if not os.environ.get("MISTRAL_API_KEY"):
        logger.error("MISTRAL_API_KEY is not set")
        await websocket.close(code=1011, reason="Server missing Mistral API key")
        return

    try:
        config_msg = await websocket.receive_text()
    except WebSocketDisconnect:
        return
    except Exception as e:
        logger.error("Failed to receive config from websocket: %s", e)
        await websocket.close(code=1003, reason="Invalid configuration")
        return

    try:
        config = json.loads(config_msg)
    except json.JSONDecodeError as e:
        logger.error("Invalid config JSON: %s", e)
        await websocket.close(code=1003, reason="Invalid configuration")
        return

    ok, err = _validate_config(config)
    if not ok:
        logger.error("Config validation failed: %s", err)
        await websocket.close(code=1003, reason=err)
        return
    if "guess_interval_ms" not in config:
        config["guess_interval_ms"] = DEFAULT_GUESS_INTERVAL_MS

    # Guesser uses server-side prompt only (game rules + transcript). Client prompt/target/options are never sent to the AI.
    logger.info("[GUESSER] Using server-side guesser prompt only (no target word, no options, no hint)")

    audio_queue: asyncio.Queue[bytes | None] = asyncio.Queue()

    async def audio_receiver() -> None:
        try:
            await audio_queue.put(b"\x00\x00" * 8000)
            logger.info("[AUDIO] Primed stream with initial silence")
            while True:
                data = await websocket.receive()
                if data.get("type") == "websocket.disconnect":
                    break
                if "bytes" in data:
                    await audio_queue.put(data["bytes"])
                elif "text" in data:
                    msg = json.loads(data["text"])
                    if msg.get("type") != "PONG":
                        logger.debug("[WS] Text from frontend: %s", data["text"])
        except WebSocketDisconnect:
            logger.info("[WS] Frontend disconnected")
        except RuntimeError as e:
            if "disconnect" in str(e).lower() and "receive" in str(e).lower():
                logger.info("[WS] Frontend disconnected")
            else:
                raise
        except Exception as e:
            logger.error("[WS] Error receiving from frontend: %s", e)
        finally:
            await audio_queue.put(None)

    receiver_task = asyncio.create_task(audio_receiver())
    try:
        await game_service.run_game(websocket, config, audio_queue)
    finally:
        receiver_task.cancel()
        try:
            await receiver_task
        except asyncio.CancelledError:
            pass
