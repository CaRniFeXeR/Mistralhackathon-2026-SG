import logging
import os


logger = logging.getLogger(__name__)

_VALID_AI_MODES = {"api", "vllm"}


def get_ai_mode() -> str:
    """
    Read AI_MODE from the environment and normalize to a supported value.
    Falls back to 'api' if unset or invalid.
    """
    mode = os.environ.get("AI_MODE", "api").lower()
    if mode not in _VALID_AI_MODES:
        logger.warning("[AI_CONFIG] Unknown AI_MODE=%r — falling back to 'api'", mode)
        return "api"
    return mode


def get_mistral_api_key() -> str | None:
    """
    Return the configured MISTRAL_API_KEY, or None if missing (and log an error).
    """
    api_key = os.environ.get("MISTRAL_API_KEY")
    if not api_key:
        logger.error("MISTRAL_API_KEY is not set")
        return None
    return api_key

