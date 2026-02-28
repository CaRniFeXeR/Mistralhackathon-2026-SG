"""
Ticker text endpoint for LaMetric / similar display devices.

GET /api/ticker/text
Returns a simple frames payload:
  - If a game is currently running → "running" (no icon)
  - Otherwise check the last finished RoomGame:
      winner_type == "human" → "Humans Win" (icon 49174)
      winner_type == "AI"    → "AI Wins"    (icon 19663)
      anything else          → "No result"  (no icon)
"""
import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.connection import get_session
from backend.app.db.models import RoomGame

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ticker"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]

ICON_HUMANS_WIN = 49174
ICON_AI_WINS = 19663


class TickerFrame(BaseModel):
    text: str
    icon: int | None = None


class TickerResponse(BaseModel):
    frames: list[TickerFrame]


@router.get("/text", response_model=TickerResponse)
async def ticker_text(session: SessionDep) -> TickerResponse:
    """
    Returns a LaMetric-style ticker payload.

    - A game currently in progress → text: "running", icon: null
    - Last finished game won by humans → text: "Humans Win", icon: 49174
    - Last finished game won by AI    → text: "AI Wins",    icon: 19663
    - No games at all / other outcome → text: "No result",  icon: null
    """
    # Check whether any game is currently running (started but not ended)
    running_q = select(RoomGame).where(RoomGame.ended_at.is_(None)).limit(1)
    running_result = await session.execute(running_q)
    running_game = running_result.scalars().first()

    if running_game is not None:
        return TickerResponse(frames=[TickerFrame(text="running", icon=None)])

    # No running game — fetch the most recently finished game
    latest_q = (
        select(RoomGame)
        .where(RoomGame.ended_at.isnot(None))
        .order_by(RoomGame.ended_at.desc())
        .limit(1)
    )
    latest_result = await session.execute(latest_q)
    latest_game = latest_result.scalars().first()

    if latest_game is None:
        return TickerResponse(frames=[TickerFrame(text="No result", icon=None)])

    if latest_game.winner_type == "human":
        return TickerResponse(
            frames=[TickerFrame(text="Humans Win", icon=ICON_HUMANS_WIN)]
        )
    if latest_game.winner_type == "AI":
        return TickerResponse(
            frames=[TickerFrame(text="AI Wins", icon=ICON_AI_WINS)]
        )

    # Covers "gm_lost", "time_up", or any unexpected value
    return TickerResponse(frames=[TickerFrame(text="No result", icon=None)])
