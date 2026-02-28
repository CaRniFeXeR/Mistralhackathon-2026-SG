from contextlib import asynccontextmanager
import logging
from pathlib import Path

from fastapi import FastAPI

# Configure logging: INFO to backend.log and console so e.g. [AI_GUESSER_INPUT] is visible.
_BASE_DIR = Path(__file__).resolve().parents[2]
_LOG_FILE = _BASE_DIR / "backend.log"
_log_fmt = logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
_root = logging.getLogger()
_root.setLevel(logging.INFO)
if not _root.handlers:
    _fh = logging.FileHandler(_LOG_FILE, encoding="utf-8")
    _fh.setLevel(logging.INFO)
    _fh.setFormatter(_log_fmt)
    _root.addHandler(_fh)
    _sh = logging.StreamHandler()
    _sh.setLevel(logging.INFO)
    _sh.setFormatter(_log_fmt)
    _root.addHandler(_sh)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.api import rooms, ws_game, ws_room
from backend.app.db.connection import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    # Shutdown: SQLAlchemy engine disposal is handled by GC; explicit close not required for SQLite.


app = FastAPI(title="Taboo API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(ws_game.router, prefix="/ws", tags=["game"])
app.include_router(ws_room.router, prefix="/ws", tags=["room"])
app.include_router(rooms.router, prefix="/api", tags=["rooms"])


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


_FRONTEND_DIST = _BASE_DIR / "frontend" / "dist"

if _FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=_FRONTEND_DIST, html=True), name="frontend")
