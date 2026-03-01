# Bill of Materials

Libraries and tools used across the project.

---

## 1. Backend

From `requirements.txt`. The backend is a FastAPI service for the Taboo-style game: WebSocket rooms, SQLite persistence, and Mistral APIs for transcription and AI guessing.

| Library | Version | Purpose |
|--------|---------|--------|
| **mistralai** | 1.12.4 | Official Mistral API client for transcription streaming and chat-based word guessing. |
| **fastapi** | 0.133.1 | Web framework for REST and WebSocket endpoints (rooms, game, room WS). |
| **python-multipart** | 0.0.22 | Parsing multipart form data (e.g. file uploads). |
| **uvicorn** | 0.30.6 | ASGI server to run the FastAPI app. |
| **uvloop** | ≥0.19.0 | High-performance event loop replacement for asyncio. |
| **httptools** | ≥0.6.0 | Fast HTTP parser used by uvicorn. |
| **websockets** | 16.0 | WebSocket support for real-time game and room connections. |
| **sqlalchemy[asyncio]** | ≥2.0 | Async ORM for games, rooms, guesses, and room members (SQLite). |
| **aiosqlite** | ≥0.20.0 | Async SQLite driver for SQLAlchemy. |
| **greenlet** | ≥3.0 | Greenlets for SQLAlchemy async support. |
| **pydantic** | ≥2.0 | Request/response validation and settings. |
| **python-jose[cryptography]** | 3.3.0 | JWT creation and validation for room auth (room_id, role, name). |
| **nanoid** | 2.0.0 | Short unique IDs (e.g. room IDs, tokens). |
| **httpx** | ≥0.28.0 | Async HTTP client for outbound calls (e.g. to Mistral or local vLLM). |
| **python-dotenv** | ≥1.0.0 | Load environment variables from `.env`. |

*vLLM and audio libs (soxr, librosa, soundfile) are installed on-demand by `run_app.sh` when using `--ai-mode vllm`.*

---

## 2. Frontend

From `frontend/package.json`. React + Vite + TypeScript app for the game UI, room joining, and real-time WebSocket interaction.

### Dependencies

| Library | Purpose |
|--------|---------|
| **react** / **react-dom** | UI framework and DOM rendering. |
| **react-router-dom** | Client-side routing (e.g. lobby vs room). |
| **lucide-react** | Icon set for buttons and UI. |
| **qrcode** | Generate QR codes for room join links. |
| **react-ascii-text** | ASCII-style text effects (e.g. titles). |

### Dev dependencies

| Library | Purpose |
|--------|---------|
| **vite** | Build tool and dev server. |
| **@vitejs/plugin-react** | React fast refresh and JSX for Vite. |
| **typescript** | Type checking and TS compilation. |
| **@types/react** / **@types/react-dom** / **@types/node** / **@types/qrcode** | TypeScript type definitions. |
| **tailwindcss** / **postcss** / **autoprefixer** | Utility-first CSS and PostCSS pipeline. |
| **eslint** / **@eslint/js** / **typescript-eslint** / **eslint-plugin-react-hooks** / **eslint-plugin-react-refresh** | Linting and code quality. |
| **globals** | Global variables for ESLint env. |

---

## 3. Finetune

From `finetuning/requirements.txt`. Pipeline to fine-tune **Mistral-Small-3.2-24B-Instruct** as a Taboo guesser (SFT with anti-parroting, run on ASUS Ascent GX10; merge LoRA for vLLM deployment).

| Library | Purpose |
|--------|---------|
| **transformers** | Hugging Face models, tokenizers, and training utilities. |
| **huggingface-hub** | Download/upload models and datasets. |
| **datasets** | Load and preprocess training/validation data (e.g. from game logs). |
| **accelerate** | Distributed training and mixed-precision. |
| **peft** | Parameter-Efficient Fine-Tuning (e.g. LoRA adapters). |
| **mistral-common** | Mistral-specific utilities and formats. |
| **tokenizers** | Fast tokenization (Hugging Face). |
| **python-dotenv** | Env vars for API keys and paths. |
| **torch** / **torchvision** / **torchcodec** | PyTorch and media/vision stacks; install from PyTorch index (e.g. CUDA 13.0). |

*Unsloth is used at runtime for memory-optimized training (e.g. in `unsloth/unsloth:dgxspark-latest`); it is not listed in `finetuning/requirements.txt`.*
