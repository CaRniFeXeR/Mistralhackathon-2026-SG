# Taboo Game Scaffold

This repo is a starter scaffold for a Taboo-style game with a **FastAPI** backend and a **React + TypeScript + Tailwind** frontend.

### Layout
- `backend/app/main.py` – FastAPI app with a `/health` endpoint and CORS for the Vite dev server.
- `frontend/` – Vite React TS app styled with Tailwind CSS.
- `run_app.sh` – Helper script to run everything in dev or prod mode.
- `build_frontend.sh` – Script to build the frontend for production.

### Prerequisites
- Python virtualenv at `.venv` with dependencies from `requirements.txt` already installed.
- Node.js + npm installed for the frontend.

### Run in development
From the repo root:

```bash
chmod +x run_app.sh
./run_app.sh --mode dev
```

- Backend: `http://localhost:8009`
- Frontend (Vite HMR): `http://localhost:5173`

### Run in production-style mode
From the repo root:

```bash
chmod +x run_app.sh build_frontend.sh
./run_app.sh --mode prod
```

This builds the frontend, then serves API + static files from FastAPI on `http://localhost:8009`.
