# 1. Use the official vLLM OpenAI-compatible image as the base
FROM vllm/vllm-openai:nightly

# 2. Apply your fixes (Example: installing a missing library or fixing a script)
# Replace these with the actual commands you ran inside your container
RUN pip install mistral-common[soundfile]
RUN pip install soxr librosa soundfile "transformers>=5.2.0"
