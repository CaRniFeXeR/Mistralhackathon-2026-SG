"""
SQLite connection and database initialization.
"""
from pathlib import Path

import aiosqlite

from backend.app.db.models import CREATE_GAMES, CREATE_GUESSES

_BACKEND_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = _BACKEND_DIR / "data"
DB_PATH = DATA_DIR / "games.db"


async def init_db() -> None:
    """Create data directory and tables if they do not exist."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute(CREATE_GAMES)
        await conn.execute(CREATE_GUESSES)
        await conn.commit()


def get_connection():
    """Return an async context manager for a DB connection (use: async with get_connection() as conn)."""
    return aiosqlite.connect(DB_PATH)
