"""
Repository for games and guesses. All SQLite access; no FastAPI or Mistral.
"""
from datetime import datetime, timezone

from backend.app.db.connection import get_connection
from backend.app.db.models import GAMES_TABLE, GUESSES_TABLE

OUTCOME_PLAYING = "playing"
OUTCOME_WON = "won"
OUTCOME_LOST = "lost"
OUTCOME_STOPPED = "stopped"


async def insert_game(
    target_word: str,
    taboo_words: str,
) -> int:
    """Insert a new game with outcome 'playing'. Returns game id."""
    async with get_connection() as conn:
        cursor = await conn.execute(
            f"""
            INSERT INTO {GAMES_TABLE}
            (target_word, taboo_words, outcome, started_at)
            VALUES (?, ?, ?, ?)
            """,
            (target_word, taboo_words, OUTCOME_PLAYING, _now()),
        )
        await conn.commit()
        return cursor.lastrowid


async def update_game_outcome(
    game_id: int,
    outcome: str,
    time_remaining_seconds: int | None = None,
    final_transcript: str | None = None,
    winning_guess: str | None = None,
) -> None:
    """Update game with final outcome and optional fields."""
    async with get_connection() as conn:
        await conn.execute(
            f"""
            UPDATE {GAMES_TABLE}
            SET outcome = ?, time_remaining_seconds = ?, final_transcript = ?, winning_guess = ?, ended_at = ?
            WHERE id = ?
            """,
            (outcome, time_remaining_seconds, final_transcript, winning_guess, _now(), game_id),
        )
        await conn.commit()


async def insert_guess(game_id: int, guess_text: str, is_win: bool) -> int:
    """Insert an AI guess. Returns guess id."""
    async with get_connection() as conn:
        cursor = await conn.execute(
            f"""
            INSERT INTO {GUESSES_TABLE} (game_id, guess_text, is_win, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (game_id, guess_text, 1 if is_win else 0, _now()),
        )
        await conn.commit()
        return cursor.lastrowid


async def get_game(game_id: int) -> dict | None:
    """Fetch a game by id. Returns None if not found."""
    async with get_connection() as conn:
        conn.row_factory = _dict_factory
        cursor = await conn.execute(
            f"SELECT * FROM {GAMES_TABLE} WHERE id = ?",
            (game_id,),
        )
        row = await cursor.fetchone()
        return dict(row) if row else None


async def list_games(limit: int = 50) -> list[dict]:
    """List recent games, newest first."""
    async with get_connection() as conn:
        conn.row_factory = _dict_factory
        cursor = await conn.execute(
            f"SELECT * FROM {GAMES_TABLE} ORDER BY id DESC LIMIT ?",
            (limit,),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _dict_factory(cursor, row):
    return {col[0]: row[i] for i, col in enumerate(cursor.description)}
