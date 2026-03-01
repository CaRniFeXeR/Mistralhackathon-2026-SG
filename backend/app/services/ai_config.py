import logging
import os
import random
from pathlib import Path
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Search for the .env file in the root directory (3 levels up from this file)
_ROOT_DIR = Path(__file__).resolve().parents[3]
_ENV_PATH = _ROOT_DIR / ".env"
_DOTENV_LOADED = load_dotenv(_ENV_PATH)
if _DOTENV_LOADED:
    logger.info("[AI_CONFIG] Environment variables loaded from: %s", _ENV_PATH)
else:
    # If not found directly, try loading from CWD as fallback
    load_dotenv()

_VALID_AI_MODES = {"api", "vllm", "hybrid", "hybrid_2"}


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


# API key pool for pseudo load-balancing (MISTRAL_API_KEY_01 to MISTRAL_API_KEY_99)
_MISTRAL_API_KEY_POOL: list[str] = []

def _initialize_api_key_pool():
    global _MISTRAL_API_KEY_POOL
    if not _MISTRAL_API_KEY_POOL:
        for i in range(1, 100):
            var_name = f"MISTRAL_API_KEY_{i:02d}"
            key = os.environ.get(var_name)
            if key:
                _MISTRAL_API_KEY_POOL.append(key)
        if _MISTRAL_API_KEY_POOL:
            logger.info("[AI_CONFIG] Mistral API key pool initialized with %d keys.", len(_MISTRAL_API_KEY_POOL))

def get_mistral_api_key(allow_pool: bool = False) -> str | None:
    """
    Return the configured MISTRAL_API_KEY, or None if missing (and log an error).
    If allow_pool=True, attempts to pick a random key from MISTRAL_API_KEY_01-99.
    """
    if allow_pool:
        _initialize_api_key_pool()
        if _MISTRAL_API_KEY_POOL:
            selected = random.choice(_MISTRAL_API_KEY_POOL)
            # Log only the last 4 characters of the key for basic auditing (safe)
            logger.info("[AI_CONFIG] Pseudo load balancing: Using random API key (ends in ...%s)", selected[-4:] if len(selected) > 4 else "(short)")
            return selected

    api_key = os.environ.get("MISTRAL_API_KEY")
    if not api_key:
        logger.error("MISTRAL_API_KEY is not set")
        return None
    return api_key

