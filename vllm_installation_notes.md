# VLLM Installation Notes

Due to Voxtral Mini 4B Realtime model's very recent integration with VLLM (earliest confirmation of this to work is from VLLM's post on [31 January 2026](https://blog.vllm.ai/2026/01/31/streaming-realtime.html)), the installation process is different from normal VLLM installation.

For this machine, the installation process is as follows:
1. Make sure that uv package manager is alrady installed. If not, install it by running `curl -LsSf https://astral.sh/uv/install.sh | sh`
2. Install latest version of Pytorch packages with CUDA 13.0 support, i.e. `pip install torch torchaudio torchvision --index-url https://download.pytorch.org/whl/cu130`
3. Then install VLLM and related packages, with extra index url pointing to CUDA 13.0 nightly wheels, with `uv` package manager:
`uv pip install -U vllm soxr librosa soundfile --extra-index-url https://wheels.vllm.ai/nightly/cu130`