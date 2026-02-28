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
if [[ "$AI_MODE" != "api" && "$AI_MODE" != "vllm" ]]; then
    echo "❌ Unknown --ai-mode: '$AI_MODE'. Use 'api' or 'vllm'."
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
#  vLLM mode: install nightly vLLM and start both model servers
# ────────────────────────────────────────────────────────────
VLLM_TRANSCRIBER_PID=""
VLLM_GUESSER_PID=""

if [[ "$AI_MODE" == "vllm" ]]; then
    echo ""
    echo "╔══════════════════════════════════════════════╗"
    echo "║  AI MODE: vLLM (local)                      ║"
    echo "║  Transcriber  →  ws://localhost:8100         ║"
    echo "║  Guesser      →  http://localhost:8101       ║"
    echo "╚══════════════════════════════════════════════╝"
    echo ""

    # ── Install vLLM nightly if not present ───────────────
    if ! python -c "import vllm" 2>/dev/null; then
        echo "📦 vLLM not found — installing nightly build (this may take a few minutes)..."
        pip install -U vllm soxr librosa soundfile \
            --extra-index-url https://wheels.vllm.ai/nightly
        echo "✅ vLLM installed."
    else
        echo "✅ vLLM already installed."
    fi

    # ── Kill any stale vLLM processes on ports 8100/8101 ──
    for PORT in 8100 8101; do
        STALE_VLLM=$(lsof -ti:$PORT 2>/dev/null || true)
        if [[ -n "$STALE_VLLM" ]]; then
            echo "⚠️  Killing stale process on :$PORT (PID $STALE_VLLM)..."
            kill -9 $STALE_VLLM 2>/dev/null || true
            sleep 0.5
        fi
    done

    # ── Start transcriber (Voxtral Mini Realtime) on :8100 ─
    echo "🚀 Starting Voxtral Mini Realtime transcriber on :8100..."
    VLLM_DISABLE_COMPILE_CACHE=1 vllm serve mistralai/Voxtral-Mini-4B-Realtime-2602 \
        --port 8100 --host 0.0.0.0 \
        --compilation_config '{"cudagraph_mode": "PIECEWISE"}' \
        >> "$DIR/vllm_transcriber.log" 2>&1 &
    VLLM_TRANSCRIBER_PID=$!
    echo "   Transcriber PID: $VLLM_TRANSCRIBER_PID (logs → vllm_transcriber.log)"

    # ── Start guesser (Mistral-Small 24B AWQ) on :8101 ────
    echo "🚀 Starting Mistral-Small-3.2-24B guesser (AWQ) on :8101..."
    vllm serve mistralai/Mistral-Small-3.2-24B-Instruct-2506 \
        --port 8101 --host 0.0.0.0 \
        --quantization awq_marlin \
        >> "$DIR/vllm_guesser.log" 2>&1 &
    VLLM_GUESSER_PID=$!
    echo "   Guesser PID:     $VLLM_GUESSER_PID (logs → vllm_guesser.log)"

    # ── Wait for both vLLM servers to be healthy ──────────
    echo ""
    echo "⏳ Waiting for vLLM servers to become healthy..."
    MAX_WAIT=300  # seconds
    ELAPSED=0

    wait_for_health() {
        local PORT=$1
        local NAME=$2
        while true; do
            if curl -sf "http://localhost:${PORT}/health" > /dev/null 2>&1; then
                echo "✅ ${NAME} on :${PORT} is healthy."
                return 0
            fi
            if [[ $ELAPSED -ge $MAX_WAIT ]]; then
                echo "❌ Timed out waiting for ${NAME} on :${PORT} after ${MAX_WAIT}s."
                echo "   Check logs: ${DIR}/vllm_${NAME,,}.log"
                exit 1
            fi
            sleep 5
            ELAPSED=$((ELAPSED + 5))
            echo "   Still waiting for ${NAME} on :${PORT}... (${ELAPSED}s / ${MAX_WAIT}s)"
        done
    }

    # Note: both polls share the ELAPSED counter; each waits until own port responds
    ELAPSED=0
    wait_for_health 8100 "transcriber"
    ELAPSED=0
    wait_for_health 8101 "guesser"

    echo ""
    echo "✅ Both vLLM servers are ready."
    echo ""

    export VLLM_TRANSCRIBER_URL="ws://localhost:8100"
    export VLLM_GUESSER_URL="http://localhost:8101"
fi

# Export AI_MODE so uvicorn / game_service.py can read it
export AI_MODE="$AI_MODE"

# ────────────────────────────────────────────────────────────
#  Helper: cleanup function (kills vLLM servers if running)
# ────────────────────────────────────────────────────────────
cleanup() {
    echo ""
    echo "Stopping..."
    if [[ -n "$VLLM_TRANSCRIBER_PID" ]]; then
        kill "$VLLM_TRANSCRIBER_PID" 2>/dev/null || true
    fi
    if [[ -n "$VLLM_GUESSER_PID" ]]; then
        kill "$VLLM_GUESSER_PID" 2>/dev/null || true
    fi
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
