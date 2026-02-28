#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  run_app.sh  –  Taboo Game launcher
#
#  Usage:
#    ./run_app.sh                              # mode=dev, ai-mode=api
#    ./run_app.sh --mode dev                   # same as above
#    ./run_app.sh --mode prod                  # build frontend, serve on :8090
#    ./run_app.sh --mode dev  --ai-mode vllm   # run local vLLM servers
#    ./run_app.sh --mode prod --ai-mode vllm
#
#  AI modes:
#    api   (default)  Mistral-hosted API for transcription + guesser.
#                     Requires MISTRAL_API_KEY env var.
#    vllm             Run both models locally via vLLM.
#                     Transcriber: mistralai/Voxtral-Mini-4B-Realtime-2602  → :8100
#                     Guesser:     mistralai/Mistral-Small-3.2-24B-Instruct-2506 (AWQ) → :8101
#                     No MISTRAL_API_KEY needed.
#    hybrid           Transcriber runs locally via vLLM (:8100), Guesser via API.
#
# ─────────────────────────────────────────────────────────────
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# ── Parse arguments ──────────────────────────────────────────
MODE="dev"      # default
AI_MODE="api"   # default

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
        --ai-mode)
            AI_MODE="$2"
            shift 2
            ;;
        --ai-mode=*)
            AI_MODE="${1#*=}"
            shift
            ;;
        -h|--help)
            echo ""
            echo "Usage: ./run_app.sh [--mode dev|prod] [--ai-mode api|vllm]"
            echo ""
            echo "  --mode dev   (default) Start backend on :8090 AND Vite dev server"
            echo "               on :5173 with HMR. Good for local development."
            echo ""
            echo "  --mode prod  Build the React frontend, then serve everything"
            echo "               (API + static files) from FastAPI on :8090."
            echo ""
            echo "  --ai-mode api   (default) Use Mistral hosted APIs for transcription"
            echo "               and AI guesser. Requires MISTRAL_API_KEY env var."
            echo ""
            echo "  --ai-mode vllm  Run both models locally via vLLM."
            echo "               Transcriber : mistralai/Voxtral-Mini-4B-Realtime-2602 on :8100"
            echo "               Guesser     : mistralai/Mistral-Small-3.2-24B-Instruct-2506 (AWQ) on :8101"
            echo "               Note: Requires sufficient GPU VRAM. Stop Ollama first if running."
            echo ""
            echo "  --ai-mode hybrid Run Transcriber locally via vLLM, Guesser via API."
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

# ── Validate arguments ───────────────────────────────────────
if [[ "$AI_MODE" != "api" && "$AI_MODE" != "vllm" && "$AI_MODE" != "hybrid" ]]; then
    echo "❌ Unknown --ai-mode: '$AI_MODE'. Use 'api', 'vllm', or 'hybrid'."
    exit 1
fi

# ── Activate virtualenv ──────────────────────────────────────
source .venv/bin/activate

# ── Kill any stale process on port 8090 ──────────────────────
STALE=$(lsof -ti:8090 2>/dev/null || true)
if [[ -n "$STALE" ]]; then
    echo "⚠️  Killing stale process on :8090 (PID $STALE)..."
    kill -9 $STALE 2>/dev/null || true
    sleep 0.5
fi

# ────────────────────────────────────────────────────────────
#  vLLM/Hybrid mode: verify that model servers are already running
#  (start them first with: ./run_vllm_models.sh)
# ────────────────────────────────────────────────────────────
if [[ "$AI_MODE" == "vllm" || "$AI_MODE" == "hybrid" ]]; then
    echo ""
    echo "╔══════════════════════════════════════════════╗"
    if [[ "$AI_MODE" == "vllm" ]]; then
        echo "║  AI MODE: vLLM (local)                      ║"
    else
        echo "║  AI MODE: Hybrid (Transcriber=vLLM, Guesser=API) ║"
    fi
    echo "║  Transcriber  →  ws://localhost:8100         ║"
    if [[ "$AI_MODE" == "vllm" ]]; then
        echo "║  Guesser      →  http://localhost:8101       ║"
    fi
    echo "╚══════════════════════════════════════════════╝"
    echo ""

    # ── Verify required vLLM servers are healthy ──────────────
    echo "🔍 Checking vLLM server health..."
    VLLM_OK=true

    if curl -sf "http://localhost:8100/health" > /dev/null 2>&1; then
        echo "✅ Transcriber on :8100 is healthy."
    else
        echo "❌ Transcriber on :8100 is NOT responding."
        VLLM_OK=false
    fi

    if [[ "$AI_MODE" == "vllm" ]]; then
        if curl -sf "http://localhost:8101/health" > /dev/null 2>&1; then
            echo "✅ Guesser on :8101 is healthy."
        else
            echo "❌ Guesser on :8101 is NOT responding."
            VLLM_OK=false
        fi
    fi

    if [[ "$VLLM_OK" == "false" ]]; then
        echo ""
        echo "⚠️  One or more vLLM servers are not running."
        echo "   Start them first in a separate terminal:"
        echo "     ./run_vllm_models.sh"
        echo "   Then re-run this script once servers are healthy."
        exit 1
    fi

    echo ""
    echo "✅ Required vLLM servers are ready. Starting app..."
    echo ""

    export VLLM_TRANSCRIBER_URL="ws://localhost:8100"
    export VLLM_GUESSER_URL="http://localhost:8101"
fi

# Export AI_MODE so uvicorn / game_service.py can read it
export AI_MODE="$AI_MODE"

# ────────────────────────────────────────────────────────────
#  Helper: cleanup function
# ────────────────────────────────────────────────────────────
cleanup() {
    echo ""
    echo "Stopping..."
}

# ────────────────────────────────────────────────────────────
#  DEV MODE
#  • Backend:  uvicorn on :8090  (API)
#  • Frontend: Vite dev server on :5173  (HMR)
# ────────────────────────────────────────────────────────────
if [[ "$MODE" == "dev" ]]; then
    echo ""
    echo "╔══════════════════════════════════════════════╗"
    echo "║  DEV mode                                   ║"
    echo "║  Backend  →  http://localhost:8090          ║"
    echo "║  Frontend →  http://localhost:5173          ║"
    echo "╚══════════════════════════════════════════════╝"
    echo ""

    # Clear the log file so this session starts clean
    > "$DIR/backend.log"

    echo "Tailing backend.log in this terminal. App logs will appear below:"
    echo "   (also available at: $DIR/backend.log)"
    echo ""

    # Start backend in background — redirect stdout+stderr into the log file
    python3 -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8090 --reload --log-level info >> "$DIR/backend.log" 2>&1 &
    BACKEND_PID=$!

    # Start Vite dev server in background (runs in a subshell — CWD of this shell stays at $DIR)
    (cd "$DIR/frontend" && npm install && npm run dev) &
    VITE_PID=$!

    # Trap Ctrl-C to kill everything
    trap "cleanup; kill $BACKEND_PID $VITE_PID 2>/dev/null; exit 0" INT TERM

    # Tail the log file in foreground — this is what you watch
    sleep 1  # give backend a moment to create the file
    tail -f "$DIR/backend.log"

# ────────────────────────────────────────────────────────────
#  PROD MODE
#  • Build frontend
#  • Serve everything from FastAPI on :8090
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
    echo "║  Serving on  →  http://localhost:8090        ║"
    echo "╚══════════════════════════════════════════════╝"
    echo ""

    # Clear the log file so this session starts clean
    > "$DIR/backend.log"

    echo "Tailing backend.log — app logs will appear below:"
    echo "   (also available at: $DIR/backend.log)"
    echo ""

    # Start uvicorn in background — redirect stdout+stderr into the log file
    python3 -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8090 --log-level info >> "$DIR/backend.log" 2>&1 &
    BACKEND_PID=$!

    trap "cleanup; kill $BACKEND_PID 2>/dev/null; exit 0" INT TERM

    sleep 1
    tail -f "$DIR/backend.log"

else
    echo "❌ Unknown mode: '$MODE'. Use 'dev' or 'prod'."
    echo "   Run './run_app.sh --help' for usage."
    exit 1
fi
