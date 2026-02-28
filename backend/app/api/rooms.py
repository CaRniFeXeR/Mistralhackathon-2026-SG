import json
import logging
import uuid
from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.auth.jwt import create_token, decode_token, JwtError
from backend.app.db.connection import get_session
from backend.app.db import repository as db
from backend.app.db.schemas import GuessSchema, RoomSchema


logger = logging.getLogger(__name__)

router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_session)]


class CreateRoomRequest(BaseModel):
    target_word: str = Field(..., min_length=1)
    taboo_words: list[str] = Field(default_factory=list)
    creator_name: str = Field("Game Master", min_length=1)


class CreateRoomResponse(BaseModel):
    room_id: str
    invite_url: str
    token: str


class JoinRoomRequest(BaseModel):
    name: str = Field(..., min_length=1)


class JoinRoomResponse(BaseModel):
    token: str


class RoomInfoResponse(BaseModel):
    id: str
    status: str
    target_word: str | None = None
    taboo_words: list[str] | None = None


class RoomGuessHistoryEntry(BaseModel):
    id: int
    guess_text: str
    is_win: bool
    source: str | None = None
    display_name: str | None = None
    created_at: datetime


class RoomHistoryResponse(BaseModel):
    id: str
    status: str
    target_word: str | None = None
    taboo_words: list[str] = Field(default_factory=list)
    final_transcript: str | None = None
    winning_guess: str | None = None
    winner_type: str | None = None
    winner_user_id: str | None = None
    winner_display_name: str | None = None
    time_remaining_seconds: int | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    created_at: datetime
    guesses: list[RoomGuessHistoryEntry] = Field(default_factory=list)


def _normalize_room_id(room_id: str) -> str:
    """Room IDs are stored lowercase (nanoid 0-9a-z). Normalize for case-insensitive lookup."""
    return room_id.strip().lower()


def _create_room_token(*, user_id: str, name: str, room_id: str, role: str) -> str:
    return create_token(
        subject=user_id,
        name=name,
        room_id=room_id,
        role=role,
    )


async def _get_room_or_404(session: AsyncSession, room_id: str) -> RoomSchema:
    room = await db.get_room(session, room_id)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    return room


@router.post(
    "/rooms",
    response_model=CreateRoomResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_room(
    request: Request, payload: CreateRoomRequest, session: SessionDep
) -> CreateRoomResponse:
    """
    Create a new game room and return its id, invite URL, and a JWT for the creator (GM).
    """
    creator_user_id = str(uuid.uuid4())
    taboo_serialized = db.encode_taboo_words(payload.taboo_words)

    room_id = await db.insert_room(
        session,
        creator_user_id=creator_user_id,
        target_word=payload.target_word,
        taboo_words=taboo_serialized,
    )

    await db.insert_room_member(
        session,
        room_id=room_id,
        user_id=creator_user_id,
        name=payload.creator_name,
        role="gm",
    )

    token = _create_room_token(
        user_id=creator_user_id,
        name=payload.creator_name,
        room_id=room_id,
        role="gm",
    )

    base_url = str(request.base_url).rstrip("/")
    invite_url = f"{base_url}/room/{room_id}"

    return CreateRoomResponse(room_id=room_id, invite_url=invite_url, token=token)


def _optional_bearer(authorization: str | None = Header(None, alias="Authorization")) -> str | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    return authorization[7:].strip() or None


@router.get(
    "/rooms/{room_id}",
    response_model=RoomInfoResponse,
)
async def get_room_info(
    room_id: str,
    session: SessionDep,
    token: str | None = Depends(_optional_bearer),
) -> RoomInfoResponse:
    """
    Basic room information. target_word and taboo_words are only returned when
    the request is authenticated with a GM token for this room.
    """
    room_id = _normalize_room_id(room_id)
    room = await _get_room_or_404(session, room_id)
    target_word: str | None = None
    taboo_words: list[str] | None = None
    if token:
        try:
            claims = decode_token(token)
            if claims.get("room_id") == room_id and claims.get("role") == "gm":
                target_word = room.target_word
                taboo_words = db.decode_taboo_words(room.taboo_words)
        except JwtError:
            pass
    return RoomInfoResponse(
        id=room.id,
        status=room.status,
        target_word=target_word,
        taboo_words=taboo_words,
    )


@router.get(
    "/rooms/{room_id}/history",
    response_model=RoomHistoryResponse,
)
async def get_room_history(
    room_id: str,
    session: SessionDep,
    token: str | None = Depends(_optional_bearer),
) -> RoomHistoryResponse:
    """
    Detailed post-game view for a room, including final transcript and full
    guess list. Only accessible to the room's Game Master (GM).
    """
    room_id = _normalize_room_id(room_id)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid token",
        )

    try:
        claims = decode_token(token)
    except JwtError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from None

    claim_room_id = claims.get("room_id")
    role = claims.get("role")
    if claim_room_id != room_id or role != "gm":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="History is only available to the Game Master for this room",
        )

    room = await _get_room_or_404(session, room_id)
    taboo_words = db.decode_taboo_words(room.taboo_words)

    guesses: list[GuessSchema] = await db.list_guesses_for_room(session, room_id)
    history_guesses: list[RoomGuessHistoryEntry] = [
        RoomGuessHistoryEntry(
            id=g.id,
            guess_text=g.guess_text,
            is_win=g.is_win,
            source=g.source,
            display_name=g.display_name,
            created_at=g.created_at,
        )
        for g in guesses
    ]

    return RoomHistoryResponse(
        id=room.id,
        status=room.status,
        target_word=room.target_word,
        taboo_words=taboo_words,
        final_transcript=room.final_transcript,
        winning_guess=room.winning_guess,
        winner_type=room.winner_type,
        winner_user_id=room.winner_user_id,
        winner_display_name=room.winner_display_name,
        time_remaining_seconds=room.time_remaining_seconds,
        started_at=room.started_at,
        ended_at=room.ended_at,
        created_at=room.created_at,
        guesses=history_guesses,
    )


@router.post(
    "/rooms/{room_id}/join",
    response_model=JoinRoomResponse,
)
async def join_room(
    room_id: str, payload: JoinRoomRequest, session: SessionDep
) -> JoinRoomResponse:
    """
    Join an existing room as a player and receive a JWT.
    """
    room_id = _normalize_room_id(room_id)
    room = await _get_room_or_404(session, room_id)
    if room.status not in (db.ROOM_STATUS_WAITING, db.ROOM_STATUS_PLAYING):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Room is no longer accepting new players",
        )

    user_id = str(uuid.uuid4())
    await db.insert_room_member(
        session,
        room_id=room_id,
        user_id=user_id,
        name=payload.name,
        role="player",
    )

    token = _create_room_token(
        user_id=user_id,
        name=payload.name,
        room_id=room_id,
        role="player",
    )

    return JoinRoomResponse(token=token)


async def get_current_room_context(
    room_id: str,
    token: str | None,
    session: AsyncSession,
) -> dict[str, Any]:
    """
    Helper used by WebSocket layer to validate a participant's JWT and membership.

    Returns a dict with:
    - room: RoomSchema
    - user_id: str
    - name: str
    - role: str
    - claims: dict
    """
    room_id = _normalize_room_id(room_id)
    if not token:
        raise JwtError("Missing token")

    claims = decode_token(token)
    claim_room_id = claims.get("room_id")
    if claim_room_id != room_id:
        raise JwtError("Token does not match room")

    user_id = str(claims.get("sub"))
    name = str(claims.get("name"))
    role = str(claims.get("role"))

    room = await _get_room_or_404(session, room_id)
    member = await db.get_room_member(session, room_id=room_id, user_id=user_id)
    if not member:
        raise JwtError("User is not a member of this room")

    return {
        "room": room,
        "user_id": user_id,
        "name": name,
        "role": role,
        "claims": claims,
    }
