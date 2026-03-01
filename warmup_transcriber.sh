#!/bin/bash

# Warmup script for Voxtral-Mini-4B-Realtime-2602 on vLLM
# This script ensures the model is loaded into VRAM and the engine is ready.

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PYTHON_SCRIPT="$SCRIPT_DIR/warmup_vllm.py"

echo "--------------------------------------------------"
echo "🚀 Initializing vLLM Transcriber Warmup..."
echo "--------------------------------------------------"

if [ ! -f "$PYTHON_SCRIPT" ]; then
    echo "❌ Error: $PYTHON_SCRIPT not found."
    exit 1
fi

# Check if port 8100 is active
if ! nc -z localhost 8100 2>/dev/null; then
    echo "❌ Error: Port 8100 is not reachable."
    echo "   Ensure ./run_vllm_models.sh is running."
    exit 1
fi

# Run the python warmup
python3 "$PYTHON_SCRIPT"

if [ $? -eq 0 ]; then
    echo "--------------------------------------------------"
    echo "✅ Transcriber is WARM and READY!"
    echo "--------------------------------------------------"
else
    echo "--------------------------------------------------"
    echo "⚠️ Warmup finished with errors."
    echo "--------------------------------------------------"
fi
