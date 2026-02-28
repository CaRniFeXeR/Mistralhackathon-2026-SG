"""
Pydantic v2 domain schemas for DB-layer objects.

These are read-models built from SQLAlchemy ORM rows via `from_attributes=True`.
They are used as the return type of repository functions so callers get
type-safe, validated objects instead of raw dicts.
"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class _OrmBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class GameSchema(_OrmBase):
    id: int
    target_word: str
    taboo_words: str  # JSON-encoded list; parse with json.loads when needed
    outcome: str
    time_remaining_seconds: int | None = None
    final_transcript: str | None = None
    winning_guess: str | None = None
    started_at: datetime
    ended_at: datetime | None = None


class GuessSchema(_OrmBase):
    id: int
    game_id: int | None = None
    room_id: str | None = None
    guess_text: str
    is_win: bool
    user_id: str | None = None
    display_name: str | None = None
    source: str | None = None
    created_at: datetime


class RoomSchema(_OrmBase):
    id: str
    creator_user_id: str
    target_word: str
    taboo_words: str  # JSON-encoded list
    status: str
    time_remaining_seconds: int | None = None
    final_transcript: str | None = None
    winning_guess: str | None = None
    winner_type: str | None = None
    winner_user_id: str | None = None
    winner_display_name: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    created_at: datetime


class RoomMemberSchema(_OrmBase):
    room_id: str
    user_id: str
    name: str
    role: str
    joined_at: datetime
