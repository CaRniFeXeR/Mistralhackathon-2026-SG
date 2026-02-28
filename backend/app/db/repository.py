"""
Repository for games, rooms, and guesses.

All DB access goes through SQLAlchemy AsyncSession; functions receive a session
as their first argument (injected via get_session() or created inline for
WebSocket handlers). Return types are Pydantic domain schemas, not raw dicts.
"""
from datetime import datetime, timezone
import json
import logging

from nanoid import generate
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.models import Game, Guess, Room, RoomMember
from backend.app.db.schemas import GameSchema, GuessSchema, RoomMemberSchema, RoomSchema

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------- #
# Outcome / status constants                                                   #
# --------------------------------------------------------------------------- #

OUTCOME_PLAYING = "playing"
OUTCOME_WON = "won"
OUTCOME_LOST = "lost"
OUTCOME_STOPPED = "stopped"

ROOM_STATUS_WAITING = "waiting"
ROOM_STATUS_PLAYING = "playing"
ROOM_STATUS_WON = "won"
ROOM_STATUS_LOST = "lost"
ROOM_STATUS_STOPPED = "stopped"

# 5-char room id: alphabet + numbers (nanoid)
ROOM_ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz"
ROOM_ID_SIZE = 5


def _now() -> datetime:
    return datetime.now(timezone.utc)


def encode_taboo_words(words: list[str] | None) -> str:
    """
    Canonical encoder for taboo_words.

    - Primary representation is JSON list (e.g. '["animal", "trunk"]').
    - Falls back to a comma-separated string if JSON encoding ever fails.
    """
    if not words:
        return "[]"
    try:
        return json.dumps([str(w) for w in words])
    except TypeError:
        logger.warning("Failed to JSON-encode taboo_words; falling back to comma-join")
        return ",".join(str(w) for w in words)


def decode_taboo_words(raw: str) -> list[str]:
    """
    Canonical decoder for taboo_words.

    Handles both the new JSON-list representation and legacy comma-separated
    strings stored in the database.
    """
    if raw is None:
        return []
    try:
        data = json.loads(raw)
        if isinstance(data, list):
            return [str(x) for x in data]
    except Exception:
        logger.warning("Failed to parse taboo_words JSON, falling back to comma-split")
    return [w.strip() for w in raw.split(",") if w.strip()]


# --------------------------------------------------------------------------- #
# Legacy single-player games (/ws/game)                                        #
# --------------------------------------------------------------------------- #


async def insert_game(
    session: AsyncSession,
    target_word: str,
    taboo_words: str,
) -> int:
    """Insert a new legacy game with outcome 'playing'. Returns game id."""
    game = Game(
        target_word=target_word,
        taboo_words=taboo_words,
        outcome=OUTCOME_PLAYING,
        started_at=_now(),
    )
    session.add(game)
    await session.flush()  # populate game.id
    return game.id


async def update_game_outcome(
    session: AsyncSession,
    game_id: int,
    outcome: str,
    time_remaining_seconds: int | None = None,
    final_transcript: str | None = None,
    winning_guess: str | None = None,
) -> None:
    """Update legacy game with final outcome and optional fields."""
    await session.execute(
        update(Game)
        .where(Game.id == game_id)
        .values(
            outcome=outcome,
            time_remaining_seconds=time_remaining_seconds,
            final_transcript=final_transcript,
            winning_guess=winning_guess,
            ended_at=_now(),
        )
    )


async def insert_guess(
    session: AsyncSession,
    guess_text: str,
    is_win: bool,
    user_id: str | None = None,
    display_name: str | None = None,
    source: str | None = None,
    game_id: int | None = None,
    room_id: str | None = None,
) -> int:
    """Insert a guess. Provide either game_id (legacy) or room_id (room game). Returns guess id."""
    guess = Guess(
        game_id=game_id,
        room_id=room_id,
        guess_text=guess_text,
        is_win=is_win,
        user_id=user_id,
        display_name=display_name,
        source=source,
        created_at=_now(),
    )
    session.add(guess)
    await session.flush()
    return guess.id


async def get_game(session: AsyncSession, game_id: int) -> GameSchema | None:
    """Fetch a game by id. Returns None if not found."""
    row = await session.get(Game, game_id)
    return GameSchema.model_validate(row) if row else None


async def list_guesses_by_game_id(
    session: AsyncSession, game_id: int
) -> list[tuple[str, str | None]]:
    """Return all guesses for a legacy game. List of (guess_text, source) ordered by created_at."""
    result = await session.execute(
        select(Guess.guess_text, Guess.source)
        .where(Guess.game_id == game_id)
        .order_by(Guess.created_at.asc())
    )
    return [(row[0], row[1]) for row in result.all()]


async def list_guesses_by_room_id(
    session: AsyncSession, room_id: str
) -> list[tuple[str, str | None]]:
    """Return all guesses for a room game. List of (guess_text, source) ordered by created_at."""
    result = await session.execute(
        select(Guess.guess_text, Guess.source)
        .where(Guess.room_id == room_id)
        .order_by(Guess.created_at.asc())
    )
    return [(row[0], row[1]) for row in result.all()]


async def list_games(session: AsyncSession, limit: int = 50) -> list[GameSchema]:
    """List recent games, newest first."""
    result = await session.execute(
        select(Game).order_by(Game.id.desc()).limit(limit)
    )
    return [GameSchema.model_validate(r) for r in result.scalars()]


# --------------------------------------------------------------------------- #
# Rooms                                                                        #
# --------------------------------------------------------------------------- #


async def insert_room(
    session: AsyncSession,
    creator_user_id: str,
    target_word: str,
    taboo_words: str,
) -> str:
    """Insert a new room in 'waiting' status. Returns room id (5-char nanoid)."""
    room_id = generate(ROOM_ID_ALPHABET, ROOM_ID_SIZE)
    room = Room(
        id=room_id,
        creator_user_id=creator_user_id,
        target_word=target_word,
        taboo_words=taboo_words,
        status=ROOM_STATUS_WAITING,
        created_at=_now(),
    )
    session.add(room)
    await session.flush()
    return room.id


async def update_room_on_start(session: AsyncSession, room_id: str) -> None:
    """Mark room as playing and set started_at."""
    await session.execute(
        update(Room)
        .where(Room.id == room_id)
        .values(status=ROOM_STATUS_PLAYING, started_at=_now())
    )


async def update_room_outcome(
    session: AsyncSession,
    room_id: str,
    status: str,
    time_remaining_seconds: int | None,
    final_transcript: str | None,
    winning_guess: str | None,
    winner_type: str | None,
    winner_user_id: str | None,
    winner_display_name: str | None,
) -> None:
    """Update room with final outcome and logging fields."""
    await session.execute(
        update(Room)
        .where(Room.id == room_id)
        .values(
            status=status,
            time_remaining_seconds=time_remaining_seconds,
            final_transcript=final_transcript,
            winning_guess=winning_guess,
            winner_type=winner_type,
            winner_user_id=winner_user_id,
            winner_display_name=winner_display_name,
            ended_at=_now(),
        )
    )


async def reset_room_for_new_game(
    session: AsyncSession,
    room_id: str,
    target_word: str,
    taboo_words: str,
) -> None:
    """Reset a room for a new game, clearing timestamps and outcomes."""
    await session.execute(
        update(Room)
        .where(Room.id == room_id)
        .values(
            target_word=target_word,
            taboo_words=taboo_words,
            status=ROOM_STATUS_WAITING,
            time_remaining_seconds=None,
            final_transcript=None,
            winning_guess=None,
            winner_type=None,
            winner_user_id=None,
            winner_display_name=None,
            started_at=None,
            ended_at=None,
        )
    )


async def get_room(session: AsyncSession, room_id: str) -> RoomSchema | None:
    """Fetch a room by id."""
    row = await session.get(Room, room_id)
    return RoomSchema.model_validate(row) if row else None


# --------------------------------------------------------------------------- #
# Room members                                                                 #
# --------------------------------------------------------------------------- #


async def insert_room_member(
    session: AsyncSession,
    room_id: str,
    user_id: str,
    name: str,
    role: str,
) -> None:
    """Upsert a member into a room."""
    existing = await session.get(RoomMember, (room_id, user_id))
    if existing:
        existing.name = name
        existing.role = role
        existing.joined_at = _now()
    else:
        session.add(
            RoomMember(
                room_id=room_id,
                user_id=user_id,
                name=name,
                role=role,
                joined_at=_now(),
            )
        )
    await session.flush()


async def get_room_member(
    session: AsyncSession, room_id: str, user_id: str
) -> RoomMemberSchema | None:
    """Fetch a single room member."""
    row = await session.get(RoomMember, (room_id, user_id))
    return RoomMemberSchema.model_validate(row) if row else None


async def list_room_members(
    session: AsyncSession, room_id: str
) -> list[RoomMemberSchema]:
    """List all members for a room, ordered by join time."""
    result = await session.execute(
        select(RoomMember)
        .where(RoomMember.room_id == room_id)
        .order_by(RoomMember.joined_at.asc())
    )
    return [RoomMemberSchema.model_validate(r) for r in result.scalars()]
