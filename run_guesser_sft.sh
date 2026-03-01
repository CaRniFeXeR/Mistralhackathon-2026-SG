#!/bin/bash

# Port 8101: Guesser SFT-ed model (Mistral-Small-24B)
# Optimized for Blackwell GB10 using FP8 Quantization

MODEL_PATH="/home/mistralhackathon/git/Mistralhackathon-2026-SG-VLLM/models/mistral-small-taboo-sft"

if [ ! -d "$MODEL_PATH" ]; then
    echo "Error: SFT-ed model not found at $MODEL_PATH"
    echo "Please run merge_model.py first."
    exit 1
fi

echo "🚀 Starting vLLM SFT-ed Guesser on port 8101..."

sudo docker run --runtime nvidia --gpus all \
    --shm-size=16g \
    -v ~/.cache/huggingface:/root/.cache/huggingface \
    -v "$MODEL_PATH":/model \
    --env "HF_TOKEN=$HF_TOKEN" \
    -p 8101:8000 \
    --ipc=host \
    --platform="linux/arm64" \
    vllm/vllm-openai:nightly \
    --model /model \
    --quantization fp8 \
    --gpu-memory-utilization 0.20 \
    --enforce-eager \
    --max-model-len 8192 \
    --max-num-seqs 8 \
    --trust-remote-code
