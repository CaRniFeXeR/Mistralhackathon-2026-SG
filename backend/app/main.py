from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.api import ws_game
from backend.app.db.connection import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    # Shutdown: nothing to close for SQLite per-connection usage


app = FastAPI(title="Taboo API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(ws_game.router, prefix="/ws", tags=["game"])


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


_BASE_DIR = Path(__file__).resolve().parents[2]
_FRONTEND_DIST = _BASE_DIR / "frontend" / "dist"

if _FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=_FRONTEND_DIST, html=True), name="frontend")
