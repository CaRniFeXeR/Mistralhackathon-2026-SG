# --- TRANSCRIBER (Voxtral-Mini-4B) on port 8100 ---
# Uses ~90GB VRAM (0.75 utilization)
sudo docker run -d --name vllm-transcriber --runtime nvidia --gpus all \
    --shm-size=16g \
    -v ~/.cache/huggingface:/root/.cache/huggingface \
    --env "HF_TOKEN=$HF_TOKEN" \
    -p 8100:8000 \
    --ipc=host \
    --platform="linux/arm64" \
    vllm-voxtral_realtime \
    --model mistralai/Voxtral-Mini-4B-Realtime-2602 \
    --enforce-eager \
    --max-model-len 8192 \
    --max-num-seqs 16 \
    --gpu-memory-utilization 0.75

# --- SFT GUESSER (Mistral-Small-24B) on port 8101 ---
# Uses ~24GB VRAM (0.20 utilization)
MODEL_PATH="/home/mistralhackathon/git/Mistralhackathon-2026-SG-VLLM/finetuning/taboo-mistral-small-finetuned-merged"

if [ -d "$MODEL_PATH" ]; then
    sudo docker run -d --name vllm-guesser --runtime nvidia --gpus all \
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
        --max-num-seqs 8
else
    echo "Warning: SFT model not found at $MODEL_PATH. Guesser will not start."
fi