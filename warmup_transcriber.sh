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

# Convert MP3 sample to raw PCM 16-bit 16kHz mono for the transcriber
SAMPLE_MP3="$SCRIPT_DIR/girls_say_hello_different_ways.mp3" #obiwan_hello_there_voice_sample.mp3"
SAMPLE_RAW="$SCRIPT_DIR/warmup_sample_2.raw"

if [ -f "$SAMPLE_MP3" ]; then
    echo "🎵 Converting $SAMPLE_MP3 to raw PCM..."
    ffmpeg -y -i "$SAMPLE_MP3" -ar 16000 -ac 1 -f s16le "$SAMPLE_RAW" &>/dev/null
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
