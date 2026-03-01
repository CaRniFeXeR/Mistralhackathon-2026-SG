"""
Ticker text endpoint for LaMetric / similar display devices.

GET /api/ticker/text
Returns a simple frames payload:
  - If the latest game (by id) is still running → "running" (icon 71388)
  - Otherwise use the latest game's result:
      winner_type == "human" → "Humans Win" (icon 49174)
      winner_type == "AI"    → "AI Wins"    (icon 19663)
      anything else          → "Waiting for new game" (icon 11370)

Optimized: single query, only id/ended_at/winner_type loaded.
"""
import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import load_only
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.connection import get_session
from backend.app.db.models import RoomGame

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ticker"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]

ICON_HUMANS_WIN = 49174
ICON_AI_WINS = 19663
ICON_RUNNING = 71388
ICON_WAITING = 11370


class TickerFrame(BaseModel):
    text: str
    icon: int | None = None


class TickerResponse(BaseModel):
    frames: list[TickerFrame]


@router.get("/text", response_model=TickerResponse)
async def ticker_text(session: SessionDep) -> TickerResponse:
    """
    Returns a LaMetric-style ticker payload.

    - Latest game (by id) still in progress → text: "running", icon: 71388
    - Latest game finished, humans won → text: "Humans Win", icon: 49174
    - Latest game finished, AI won      → text: "AI Wins",    icon: 19663
    - No games / other outcome         → text: "Waiting for new game", icon: 11370
    """
    # Single query: latest game by id, only columns needed for the decision
    latest_q = (
        select(RoomGame)
        .options(load_only(RoomGame.id, RoomGame.ended_at, RoomGame.winner_type))
        .order_by(RoomGame.id.desc())
        .limit(1)
    )
    result = await session.execute(latest_q)
    latest = result.scalars().first()

    if latest is None:
        return TickerResponse(frames=[TickerFrame(text="Waiting for new game", icon=ICON_WAITING)])

    if latest.ended_at is None:
        return TickerResponse(frames=[TickerFrame(text="running", icon=ICON_RUNNING)])

    if latest.winner_type == "human":
        return TickerResponse(
            frames=[TickerFrame(text="Humans Win", icon=ICON_HUMANS_WIN)]
        )
    if latest.winner_type == "AI":
        return TickerResponse(
            frames=[TickerFrame(text="AI Wins", icon=ICON_AI_WINS)]
        )

    return TickerResponse(frames=[TickerFrame(text="Waiting for new game", icon=ICON_WAITING)])
