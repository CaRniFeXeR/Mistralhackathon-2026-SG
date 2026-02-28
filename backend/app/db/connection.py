"""
SQLAlchemy async engine, session factory, and DB initialisation.
"""
from pathlib import Path
from typing import AsyncGenerator, AsyncIterator
from contextlib import asynccontextmanager

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


async def init_db() -> None:
    """Create the data directory and all DB tables (idempotent)."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


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
