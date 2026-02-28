"""
SQLite connection and database initialization.
"""
from pathlib import Path

import aiosqlite

from backend.app.db.models import (
    CREATE_GAMES,
    CREATE_GUESSES,
    CREATE_ROOM_MEMBERS,
    CREATE_ROOMS,
    GUESSES_TABLE,
)

_BACKEND_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = _BACKEND_DIR / "data"
DB_PATH = DATA_DIR / "games.db"


async def init_db() -> None:
    """Create data directory and tables if they do not exist."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as conn:
        # Base tables
        await conn.execute(CREATE_GAMES)
        await conn.execute(CREATE_GUESSES)
        await conn.execute(CREATE_ROOMS)
        await conn.execute(CREATE_ROOM_MEMBERS)

        # Lightweight migration for guesses attribution columns (SQLite: ALTER TABLE ADD COLUMN).
        # These may fail if columns already exist; errors are ignored.
        alter_statements = [
            f"ALTER TABLE {GUESSES_TABLE} ADD COLUMN user_id TEXT",
            f"ALTER TABLE {GUESSES_TABLE} ADD COLUMN display_name TEXT",
            f"ALTER TABLE {GUESSES_TABLE} ADD COLUMN source TEXT",
        ]
        for sql in alter_statements:
            try:
                await conn.execute(sql)
            except Exception:
                # Column likely already exists; ignore.
                pass

        await conn.commit()


def get_connection():
    """Return an async context manager for a DB connection (use: async with get_connection() as conn)."""
    return aiosqlite.connect(DB_PATH)
