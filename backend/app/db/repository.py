"""
Repository for games, rooms, and guesses. All SQLite access; no FastAPI or Mistral.
"""
from datetime import datetime, timezone
from typing import Any

from backend.app.db.connection import get_connection
from backend.app.db.models import GAMES_TABLE, GUESSES_TABLE, ROOM_MEMBERS_TABLE, ROOMS_TABLE

OUTCOME_PLAYING = "playing"
OUTCOME_WON = "won"
OUTCOME_LOST = "lost"
OUTCOME_STOPPED = "stopped"

ROOM_STATUS_WAITING = "waiting"
ROOM_STATUS_PLAYING = "playing"
ROOM_STATUS_WON = "won"
ROOM_STATUS_LOST = "lost"
ROOM_STATUS_STOPPED = "stopped"


# Legacy game helpers (used by /ws/game single-player mode)

async def insert_game(
    target_word: str,
    taboo_words: str,
) -> int:
    """Insert a new legacy game with outcome 'playing'. Returns game id."""
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
    """Update legacy game with final outcome and optional fields."""
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


async def insert_guess(
    game_id: int,
    guess_text: str,
    is_win: bool,
    user_id: str | None = None,
    display_name: str | None = None,
    source: str | None = None,
) -> int:
    """
    Insert a guess. Returns guess id.

    For legacy single-player games, user_id/display_name/source are left NULL.
    Room-based games are expected to populate source ('human' | 'AI') and attribution.
    """
    async with get_connection() as conn:
        cursor = await conn.execute(
            f"""
            INSERT INTO {GUESSES_TABLE}
            (game_id, guess_text, is_win, user_id, display_name, source, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (game_id, guess_text, 1 if is_win else 0, user_id, display_name, source, _now()),
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


# Rooms and room members

async def insert_room(
    creator_user_id: str,
    target_word: str,
    taboo_words: str,
) -> int:
    """Insert a new room in 'waiting' status. Returns room id."""
    async with get_connection() as conn:
        cursor = await conn.execute(
            f"""
            INSERT INTO {ROOMS_TABLE}
            (creator_user_id, target_word, taboo_words, status, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (creator_user_id, target_word, taboo_words, ROOM_STATUS_WAITING, _now()),
        )
        await conn.commit()
        return cursor.lastrowid


async def update_room_on_start(room_id: int) -> None:
    """Mark room as playing and set started_at."""
    async with get_connection() as conn:
        await conn.execute(
            f"""
            UPDATE {ROOMS_TABLE}
            SET status = ?, started_at = ?
            WHERE id = ?
            """,
            (ROOM_STATUS_PLAYING, _now(), room_id),
        )
        await conn.commit()


async def update_room_outcome(
    room_id: int,
    status: str,
    time_remaining_seconds: int | None,
    final_transcript: str | None,
    winning_guess: str | None,
    winner_type: str | None,
    winner_user_id: str | None,
    winner_display_name: str | None,
) -> None:
    """Update room with final outcome and logging fields."""
    async with get_connection() as conn:
        await conn.execute(
            f"""
            UPDATE {ROOMS_TABLE}
            SET status = ?,
                time_remaining_seconds = ?,
                final_transcript = ?,
                winning_guess = ?,
                winner_type = ?,
                winner_user_id = ?,
                winner_display_name = ?,
                ended_at = ?
            WHERE id = ?
            """,
            (
                status,
                time_remaining_seconds,
                final_transcript,
                winning_guess,
                winner_type,
                winner_user_id,
                winner_display_name,
                _now(),
                room_id,
            ),
        )
        await conn.commit()


async def get_room(room_id: int) -> dict | None:
    """Fetch a room by id."""
    async with get_connection() as conn:
        conn.row_factory = _dict_factory
        cursor = await conn.execute(
            f"SELECT * FROM {ROOMS_TABLE} WHERE id = ?",
            (room_id,),
        )
        row = await cursor.fetchone()
        return dict(row) if row else None


async def insert_room_member(
    room_id: int,
    user_id: str,
    name: str,
    role: str,
) -> None:
    """Insert a member into a room."""
    async with get_connection() as conn:
        await conn.execute(
            f"""
            INSERT OR REPLACE INTO {ROOM_MEMBERS_TABLE}
            (room_id, user_id, name, role, joined_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (room_id, user_id, name, role, _now()),
        )
        await conn.commit()


async def get_room_member(room_id: int, user_id: str) -> dict | None:
    """Fetch a single room member."""
    async with get_connection() as conn:
        conn.row_factory = _dict_factory
        cursor = await conn.execute(
            f"""
            SELECT * FROM {ROOM_MEMBERS_TABLE}
            WHERE room_id = ? AND user_id = ?
            """,
            (room_id, user_id),
        )
        row = await cursor.fetchone()
        return dict(row) if row else None


async def list_room_members(room_id: int) -> list[dict]:
    """List all members for a room."""
    async with get_connection() as conn:
        conn.row_factory = _dict_factory
        cursor = await conn.execute(
            f"""
            SELECT * FROM {ROOM_MEMBERS_TABLE}
            WHERE room_id = ?
            ORDER BY joined_at ASC
            """,
            (room_id,),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _dict_factory(cursor: Any, row: Any) -> dict:
    return {col[0]: row[i] for i, col in enumerate(cursor.description)}
