"""
SQLAlchemy 2 declarative ORM models for the Taboo game.

Tables (schema identical to previous hand-written DDL):
  games, guesses, rooms, room_members
"""
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Game(Base):
    __tablename__ = "games"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    target_word: Mapped[str] = mapped_column(Text, nullable=False)
    taboo_words: Mapped[str] = mapped_column(Text, nullable=False)
    outcome: Mapped[str] = mapped_column(String(32), nullable=False)
    time_remaining_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    final_transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    winning_guess: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    guesses: Mapped[list["Guess"]] = relationship("Guess", back_populates="game")


class Guess(Base):
    __tablename__ = "guesses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    game_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("games.id"), nullable=True
    )
    room_id: Mapped[str | None] = mapped_column(String(5), ForeignKey("rooms.id"), nullable=True)
    guess_text: Mapped[str] = mapped_column(Text, nullable=False)
    is_win: Mapped[bool] = mapped_column(Boolean, nullable=False)
    user_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    display_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(String(16), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    game: Mapped["Game"] = relationship("Game", back_populates="guesses")


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[str] = mapped_column(String(5), primary_key=True, autoincrement=False)
    creator_user_id: Mapped[str] = mapped_column(String(64), nullable=False)
    target_word: Mapped[str] = mapped_column(Text, nullable=False)
    taboo_words: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    time_remaining_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    final_transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    winning_guess: Mapped[str | None] = mapped_column(Text, nullable=True)
    winner_type: Mapped[str | None] = mapped_column(String(16), nullable=True)
    winner_user_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    winner_display_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    members: Mapped[list["RoomMember"]] = relationship("RoomMember", back_populates="room")


class RoomMember(Base):
    __tablename__ = "room_members"

    room_id: Mapped[str] = mapped_column(
        String(5), ForeignKey("rooms.id"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    room: Mapped["Room"] = relationship("Room", back_populates="members")
