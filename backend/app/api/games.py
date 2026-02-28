"""
List past room games and export AI guess history.
"""
import csv
import io
import json
import logging
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.connection import get_session
from backend.app.db import repository as db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["games"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


class PastGameEntry(BaseModel):
    id: int
    room_id: str
    target_word: str
    taboo_words: list[str]
    started_at: datetime
    ended_at: datetime | None
    winner_type: str | None
    winning_guess: str | None
    final_transcript: str | None


@router.get("", response_model=list[PastGameEntry])
async def list_past_games(
    session: SessionDep,
    limit: int = Query(50, ge=1, le=200),
    room_id: str | None = Query(None, description="Filter by room id"),
) -> list[PastGameEntry]:
    """
    List finished room games (past rounds), newest first.
    Optional room_id filter.
    """
    rows = await db.list_room_games(session, limit=limit, room_id=room_id)
    return [
        PastGameEntry(
            id=r.id,
            room_id=r.room_id,
            target_word=r.target_word,
            taboo_words=db.decode_taboo_words(r.taboo_words),
            started_at=r.started_at,
            ended_at=r.ended_at,
            winner_type=r.winner_type,
            winning_guess=r.winning_guess,
            final_transcript=r.final_transcript,
        )
        for r in rows
    ]


@router.get("/export-all")
async def export_all_games(
    session: SessionDep,
    limit: int = Query(50, ge=1, le=200),
    room_id: str | None = Query(None, description="Filter by room id"),
) -> Response:
    """
    Download all finished games with their AI guess logs (including full_prompt) as one JSON file.
    """
    rows = await db.list_room_games(session, limit=limit, room_id=room_id)
    payload = []
    for r in rows:
        logs = await db.list_ai_guess_logs_by_room_game(session, r.id)
        payload.append({
            "id": r.id,
            "room_id": r.room_id,
            "target_word": r.target_word,
            "taboo_words": db.decode_taboo_words(r.taboo_words),
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "ended_at": r.ended_at.isoformat() if r.ended_at else None,
            "winner_type": r.winner_type,
            "winning_guess": r.winning_guess,
            "final_transcript": r.final_transcript,
            "ai_guess_logs": [
                {
                    "prompt_input": log.prompt_input,
                    "full_prompt": log.full_prompt,
                    "llm_output": log.llm_output,
                    "ground_truth": log.ground_truth,
                    "created_at": log.created_at.isoformat() if log.created_at else None,
                }
                for log in logs
            ],
        })
    return Response(
        content=json.dumps(payload, indent=2),
        media_type="application/json",
        headers={
            "Content-Disposition": 'attachment; filename="all-games-export.json"',
        },
    )


@router.get("/{game_id}/ai-guess-export")
async def export_ai_guess_history(
    game_id: int,
    session: SessionDep,
    format: str = Query("json", description="json or csv"),
) -> Response:
    """
    Export AI guess log for one room game: prompt_input, llm_output, ground_truth, created_at.
    """
    room_game = await db.get_room_game(session, game_id)
    if not room_game:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found",
        )
    logs = await db.list_ai_guess_logs_by_room_game(session, game_id)

    if format == "csv":
        out = io.StringIO()
        writer = csv.writer(out)
        writer.writerow(["prompt_input", "full_prompt", "llm_output", "ground_truth", "created_at"])
        for log in logs:
            writer.writerow([
                log.prompt_input,
                log.full_prompt or "",
                log.llm_output,
                log.ground_truth,
                log.created_at.isoformat() if log.created_at else "",
            ])
        return Response(
            content=out.getvalue(),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="ai-guess-history-{game_id}.csv"',
            },
        )

    # default: json
    body = [
        {
            "prompt_input": log.prompt_input,
            "full_prompt": log.full_prompt,
            "llm_output": log.llm_output,
            "ground_truth": log.ground_truth,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]
    return Response(
        content=json.dumps(body, indent=2),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="ai-guess-history-{game_id}.json"',
        },
    )
