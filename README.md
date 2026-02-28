# Taboo Game

A real-time multiplayer Taboo-style game with a **FastAPI** backend and a **React + TypeScript + Tailwind** frontend.

### Tech Stack

| Layer | Technology |
|---|---|
| API framework | FastAPI |
| DB ORM | SQLAlchemy 2 (async) |
| DB driver | aiosqlite (SQLite) |
| Schema / validation | Pydantic v2 |
| Auth | python-jose JWT |
| AI | Mistral AI (transcription + guesser) |
| Frontend | Vite · React · TypeScript · Tailwind CSS |

### Layout

- `backend/app/main.py` – FastAPI app entry point (lifespan, CORS, routers).
- `backend/app/db/models.py` – SQLAlchemy declarative ORM models (`Game`, `Guess`, `Room`, `RoomMember`).
- `backend/app/db/schemas.py` – Pydantic v2 domain schemas returned by repository functions.
- `backend/app/db/connection.py` – Async engine, session factory, and `get_session` FastAPI dependency.
- `backend/app/db/repository.py` – All DB queries; typed inputs and outputs via SQLAlchemy + Pydantic.
- `backend/app/api/` – HTTP (`rooms.py`) and WebSocket (`ws_game.py`, `ws_room.py`) endpoints.
- `backend/app/services/` – Game orchestration and Mistral integration.
- `frontend/` – Vite React TS app styled with Tailwind CSS.
- `run_app.sh` – Helper script to run everything in dev or prod mode.
- `build_frontend.sh` – Script to build the frontend for production.

### Prerequisites

- Python virtualenv at `.venv` with dependencies from `requirements.txt` installed:
  ```bash
  python -m venv .venv
  .venv/bin/pip install -r requirements.txt
  ```
- Node.js + npm installed for the frontend.
- Environment variables: `MISTRAL_API_KEY` and `JWT_SECRET`.

### Run in development

From the repo root:

```bash
chmod +x run_app.sh
./run_app.sh --mode dev
```

- Backend: `http://localhost:8080`
- Frontend (Vite HMR): `http://localhost:5173`

### Run in production-style mode

From the repo root:

```bash
chmod +x run_app.sh build_frontend.sh
./run_app.sh --mode prod
```

This builds the frontend, then serves API + static files from FastAPI on `http://localhost:8080`.
