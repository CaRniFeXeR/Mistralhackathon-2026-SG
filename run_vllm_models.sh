#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  run_vllm_models.sh  –  Taboo Game vLLM model server launcher
#
#  Starts both local vLLM model servers and keeps them running.
#  Run this BEFORE starting the app with ./run_app.sh --ai-mode vllm.
#
#  Usage:
#    ./run_vllm_models.sh           # start both servers in foreground
#    ./run_vllm_models.sh --help    # show usage
#
#  Servers:
#    Transcriber : mistralai/Voxtral-Mini-4B-Realtime-2602         → ws://localhost:8100/v1/realtime
#    Guesser     : mistralai/Mistral-Small-3.2-24B-Instruct-2506   → http://localhost:8101 (AWQ 4-bit)
#
#  Prerequisites:
#    1. Stop Ollama first to free the CUDA context:
#         sudo systemctl stop ollama
#    2. vLLM nightly must be installed in the virtualenv:
#         pip install -U vllm soxr librosa soundfile \
#             --extra-index-url https://wheels.vllm.ai/nightly
#    3. HuggingFace credentials if models are gated:
#         export HF_TOKEN=<your-token>
# ─────────────────────────────────────────────────────────────
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# ── Parse arguments ──────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help)
            echo ""
            echo "Usage: ./run_vllm_models.sh"
            echo ""
            echo "Starts both vLLM model servers for the Taboo Game backend."
            echo "Run this BEFORE ./run_app.sh --ai-mode vllm"
            echo ""
            echo "Servers:"
            echo "  Transcriber (Voxtral Mini 4B)       → ws://localhost:8100/v1/realtime"
            echo "  Guesser     (Mistral-Small 24B AWQ)  → http://localhost:8101"
            echo ""
            echo "Prerequisites:"
            echo "  sudo systemctl stop ollama   # free CUDA context first"
            echo "  export HF_TOKEN=<token>      # if models are gated on HuggingFace"
            echo ""
            exit 0
            ;;
        *)
            echo "❌ Unknown argument: $1"
            echo "   Run './run_vllm_models.sh --help' for usage."
            exit 1
            ;;
    esac
done

# ── Activate virtualenv ──────────────────────────────────────
source .venv/bin/activate

# ── Check vLLM is installed ──────────────────────────────────
if ! python -c "import vllm" 2>/dev/null; then
    echo ""
    echo "❌ vLLM is not installed in the virtualenv."
    echo "   Install it with:"
    echo "     pip install -U vllm soxr librosa soundfile \\"
    echo "         --extra-index-url https://wheels.vllm.ai/nightly"
    exit 1
fi

# ── Kill any stale processes on ports 8100/8101 ──────────────
for PORT in 8100 8101; do
    STALE=$(lsof -ti:$PORT 2>/dev/null || true)
    if [[ -n "$STALE" ]]; then
        echo "⚠️  Killing stale process on :$PORT (PID $STALE)..."
        kill -9 $STALE 2>/dev/null || true
        sleep 0.5
    fi
done

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  vLLM Model Servers                                     ║"
echo "║  Transcriber : mistralai/Voxtral-Mini-4B-Realtime-2602  ║"
echo "║                → ws://localhost:8100/v1/realtime         ║"
echo "║  Guesser     : Mistral-Small-3.2-24B-Instruct-2506 AWQ  ║"
echo "║                → http://localhost:8101                   ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "⚠️  Make sure Ollama is stopped before proceeding:"
echo "     sudo systemctl stop ollama"
echo ""

# ── Start transcriber (Voxtral Mini 4B Realtime) on :8100 ───
echo "🚀 Starting Voxtral Mini Realtime transcriber on :8100..."
echo "   Logs → $DIR/vllm_transcriber.log"
> "$DIR/vllm_transcriber.log"
VLLM_DISABLE_COMPILE_CACHE=1 vllm serve mistralai/Voxtral-Mini-4B-Realtime-2602 \
    --port 8100 --host 0.0.0.0 \
    --compilation_config '{"cudagraph_mode": "PIECEWISE"}' \
    >> "$DIR/vllm_transcriber.log" 2>&1 &
VLLM_TRANSCRIBER_PID=$!
echo "   Transcriber PID: $VLLM_TRANSCRIBER_PID"

# ── Start guesser (Mistral-Small 24B AWQ) on :8101 ──────────
echo "🚀 Starting Mistral-Small-3.2-24B guesser (AWQ 4-bit) on :8101..."
echo "   Logs → $DIR/vllm_guesser.log"
> "$DIR/vllm_guesser.log"
vllm serve mistralai/Mistral-Small-3.2-24B-Instruct-2506 \
    --port 8101 --host 0.0.0.0 \
    --quantization awq_marlin \
    >> "$DIR/vllm_guesser.log" 2>&1 &
VLLM_GUESSER_PID=$!
echo "   Guesser PID:     $VLLM_GUESSER_PID"

# ── Cleanup on Ctrl-C ────────────────────────────────────────
cleanup() {
    echo ""
    echo "Stopping vLLM servers..."
    kill "$VLLM_TRANSCRIBER_PID" "$VLLM_GUESSER_PID" 2>/dev/null || true
    exit 0
}
trap cleanup INT TERM

# ── Wait for both servers to be healthy ─────────────────────
echo ""
echo "⏳ Waiting for vLLM servers to become healthy (model download may take a while on first run)..."
echo "   Tail transcriber logs: tail -f $DIR/vllm_transcriber.log"
echo "   Tail guesser logs:     tail -f $DIR/vllm_guesser.log"
echo ""

MAX_WAIT=600  # 10 minutes — first run may download model weights

wait_for_health() {
    local PORT=$1
    local NAME=$2
    local ELAPSED=0
    while true; do
        if ! kill -0 "$VLLM_TRANSCRIBER_PID" 2>/dev/null && ! kill -0 "$VLLM_GUESSER_PID" 2>/dev/null; then
            echo "❌ Both vLLM processes have exited unexpectedly. Check the log files."
            exit 1
        fi
        if curl -sf "http://localhost:${PORT}/health" > /dev/null 2>&1; then
            echo "✅ ${NAME} on :${PORT} is healthy."
            return 0
        fi
        if [[ $ELAPSED -ge $MAX_WAIT ]]; then
            echo "❌ Timed out waiting for ${NAME} on :${PORT} after ${MAX_WAIT}s."
            echo "   Check logs:"
            echo "     tail -f $DIR/vllm_transcriber.log"
            echo "     tail -f $DIR/vllm_guesser.log"
            cleanup
            exit 1
        fi
        sleep 5
        ELAPSED=$((ELAPSED + 5))
        echo "   [${ELAPSED}s] Waiting for ${NAME} on :${PORT}..."
    done
}

wait_for_health 8100 "Transcriber"
wait_for_health 8101 "Guesser"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  ✅ Both vLLM servers are ready!            ║"
echo "║                                              ║"
echo "║  Now start the app in another terminal:     ║"
echo "║    ./run_app.sh --mode dev --ai-mode vllm   ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "Keeping servers alive. Press Ctrl-C to stop."

# ── Keep this script alive (the servers run as children) ────
# Tail both log files to the terminal so you can see server activity
tail -f "$DIR/vllm_transcriber.log" "$DIR/vllm_guesser.log"
