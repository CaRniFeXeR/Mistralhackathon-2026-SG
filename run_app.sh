#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  run_app.sh  –  Taboo Game launcher
#
#  Usage:
#    ./run_app.sh              # same as --mode dev
#    ./run_app.sh --mode dev   # backend on :8080 + Vite HMR on :5173
#    ./run_app.sh --mode prod  # build frontend, serve everything on :8080
#
# ─────────────────────────────────────────────────────────────
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# ── Parse arguments ─────────────────────────────────────────
MODE="dev"   # default

while [[ $# -gt 0 ]]; do
    case "$1" in
        --mode)
            MODE="$2"
            shift 2
            ;;
        --mode=*)
            MODE="${1#*=}"
            shift
            ;;
        -h|--help)
            echo ""
            echo "Usage: ./run_app.sh [--mode dev|prod]"
            echo ""
            echo "  --mode dev   (default) Start backend on :8080 AND Vite dev server"
            echo "               on :5173 with HMR. Good for local development."
            echo ""
            echo "  --mode prod  Build the React frontend, then serve everything"
            echo "               (API + static files) from FastAPI on :8080."
            echo ""
            exit 0
            ;;
        *)
            echo "❌ Unknown argument: $1"
            echo "   Run './run_app.sh --help' for usage."
            exit 1
            ;;
    esac
done

# ── Activate virtualenv ──────────────────────────────────────
source .venv/bin/activate

# ── Kill any stale process on port 8080 ──────────────────────
STALE=$(lsof -ti:8080 2>/dev/null || true)
if [[ -n "$STALE" ]]; then
    echo "⚠️  Killing stale process on :8080 (PID $STALE)..."
    kill -9 $STALE 2>/dev/null || true
    sleep 0.5
fi

# ────────────────────────────────────────────────────────────
#  DEV MODE
#  • Backend:  uvicorn on :8080  (API)
#  • Frontend: Vite dev server on :5173  (HMR)
# ────────────────────────────────────────────────────────────
if [[ "$MODE" == "dev" ]]; then
    echo ""
    echo "╔══════════════════════════════════════════════╗"
    echo "║  DEV mode                                   ║"
    echo "║  Backend  →  http://localhost:8080          ║"
    echo "║  Frontend →  http://localhost:5173          ║"
    echo "╚══════════════════════════════════════════════╝"
    echo ""

    # Clear the log file so this session starts clean
    > "$DIR/backend.log"

    echo "Tailing backend.log in this terminal. App logs will appear below:"
    echo "   (also available at: $DIR/backend.log)"
    echo ""

    # Start backend in background — redirect stdout+stderr into the log file
    python3 -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8080 --reload --log-level info >> "$DIR/backend.log" 2>&1 &
    BACKEND_PID=$!

    # Start Vite dev server in background (runs in a subshell — CWD of this shell stays at $DIR)
    (cd "$DIR/frontend" && npm install && npm run dev) &
    VITE_PID=$!

    # Trap Ctrl-C to kill both
    trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID $VITE_PID 2>/dev/null; exit 0" INT TERM

    # Tail the log file in foreground — this is what you watch
    sleep 1  # give backend a moment to create the file
    tail -f "$DIR/backend.log"

# ────────────────────────────────────────────────────────────
#  PROD MODE
#  • Build frontend
#  • Serve everything from FastAPI on :8080
# ────────────────────────────────────────────────────────────
elif [[ "$MODE" == "prod" ]]; then
    echo ""
    echo "╔══════════════════════════════════════════════╗"
    echo "║  PROD mode                                  ║"
    echo "║  Building frontend...                       ║"
    echo "╚══════════════════════════════════════════════╝"
    echo ""

    cd frontend
    npm install
    npm run build
    cd ..

    echo ""
    echo "Frontend built → frontend/dist"
    echo ""
    echo "╔══════════════════════════════════════════════╗"
    echo "║  Serving on  →  http://localhost:8080        ║"
    echo "╚══════════════════════════════════════════════╝"
    echo ""

    # Clear the log file so this session starts clean
    > "$DIR/backend.log"

    echo "Tailing backend.log — app logs will appear below:"
    echo "   (also available at: $DIR/backend.log)"
    echo ""

    # Start uvicorn in background — redirect stdout+stderr into the log file
    python3 -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8080 --log-level info >> "$DIR/backend.log" 2>&1 &
    BACKEND_PID=$!

    trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID 2>/dev/null; exit 0" INT TERM

    sleep 1
    tail -f "$DIR/backend.log"

else
    echo "❌ Unknown mode: '$MODE'. Use 'dev' or 'prod'."
    echo "   Run './run_app.sh --help' for usage."
    exit 1
fi

