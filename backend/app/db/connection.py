"""
SQLAlchemy async engine, session factory, and DB initialisation.
"""
from pathlib import Path
from typing import AsyncGenerator, AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.app.db.models import Base

_BACKEND_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = _BACKEND_DIR / "data"
DB_PATH = DATA_DIR / "games.db"

DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

engine = create_async_engine(
    DATABASE_URL,
    echo=False,          # set to True during debugging
    future=True,
)

async_session_factory = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


def _add_full_prompt_if_missing(sync_conn):  # noqa: ANN001
    """Add full_prompt column to ai_guess_logs if missing (for existing DBs)."""
    cursor = sync_conn.execute(text("PRAGMA table_info(ai_guess_logs)"))
    rows = cursor.fetchall()
    if not rows:
        return  # table does not exist yet; create_all will create it with full_prompt
    columns = [row[1] for row in rows]
    if "full_prompt" not in columns:
        sync_conn.execute(text("ALTER TABLE ai_guess_logs ADD COLUMN full_prompt TEXT"))


async def init_db() -> None:
    """Create the data directory and all DB tables (idempotent)."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_add_full_prompt_if_missing)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a transactional AsyncSession."""
    async with async_session_factory() as session:
        async with session.begin():
            yield session


@asynccontextmanager
async def db_transaction() -> AsyncIterator[AsyncSession]:
    """
    Convenience async context manager that yields a transactional AsyncSession.

    Mirrors the pattern used by get_session() but is safe to use from
    non-FastAPI orchestration code (e.g. WebSocket handlers, services).
    """
    async with async_session_factory() as session:
        async with session.begin():
            yield session
