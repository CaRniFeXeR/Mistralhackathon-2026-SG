
#build docker image based on vllm/vllm-openai:nightly from 
# local Dockerfile containing all required fixes to make VLLM 
# docker image work with Voxtral-Mini-4B-Realtime-2602.

#note the -p parameter: maps localhost 8100 port to container's 8000 port
sudo docker run --runtime nvidia --gpus all \
    --shm-size=8g \
    -v ~/.cache/huggingface:/root/.cache/huggingface \
    --env "HF_TOKEN=$HF_TOKEN" \
    -p 8100:8000 \
    --ipc=host \
    --platform="linux/arm64" \
    vllm-voxtral_realtime \
    --model mistralai/Voxtral-Mini-4B-Realtime-2602 \
    --enforce-eager \
    --max-model-len 16384 \
    --max-num-seqs 16 \
    --max-num-batched-tokens 16384 \
    --enable-chunked-prefill \
    --gpu-memory-utilization 0.8 \


    # --tensor-parallel-size 1 \
    # --trust-remote-code

# # Theoretically possible if you have enough compute power (e.g. AWS).
# # Currently not possible in this machine.
# sudo docker run --runtime nvidia --gpus all \
#     --shm-size=8g \
#     -v ~/.cache/huggingface:/root/.cache/huggingface \
#     --env "HF_TOKEN=$HF_TOKEN" \
#     -p 8101:8000 \
#     --ipc=host \
#     --platform="linux/arm64" \
#     vllm/vllm-openai:latest \
#     --compilation-config '{"cudagraph_mode": "PIECEWISE"}' \
#     --gpu-memory-utilization 0.50 \
#     --model mistralai/Mistral-Small-3.2-24B-Instruct-2506 \
#     --quantization fp8 \
#     --max-model-len 24576 #32768 #16384
#     # --model jeffcookio/Mistral-Small-3.2-24B-Instruct-2506-awq-sym \