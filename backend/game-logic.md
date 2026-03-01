# Backend Game Logic & Core Mechanics

This document summarizes the core backend mechanics of the Taboo game, focusing on concurrency, locking, and parallelization.

## 1. Core Game Flow

The backend manages game sessions through a multi-participant WebSocket room system (`ws_room.py`).

- **Roles**:
    - **Game Master (GM)**: Streams audio describing the target word. The backend transcribes this in real-time and runs the AI guesser loop.
    - **Players**: Submit guesses via text or voice. Voice is transcribed on-the-fly to extract potential guesses.
- **Winning/Losing**:
    - **Win**: The first correct guess (from any player or the AI) wins the game.
    - **Loss**: The GM loses if they speak the **target word** or any **taboo word** (detected in the transcript), or if the timer runs out.

## 2. Locking Mechanisms (`asyncio.Lock`)

To prevent race conditions in a multi-participant environment, the backend uses per-room locks (`_room_locks`).

- **Sequential Guess Processing**: All guesses (human text, human voice, or AI) are funneled through `_process_guess`, which acquires the room lock. This ensures:
    - Only one "first" winner is declared.
    - Guesses arriving after a game has ended are ignored.
    - Database updates (outcome, scores) are atomic relative to the game state.
- **State Transitions**: Handlers for `START_GAME`, `NEW_GAME`, and `TIME_UP` acquire the same lock to safely transition the in-memory `RoomGameState`.

## 3. Parallelization & Concurrency

The backend heavily leverages `asyncio` to handle multiple simultaneous data streams:

- **Background Tasks (`asyncio.Task`)**:
    - **Transcription Streams**: Persistent tasks manage the bi-directional stream between the backend and the AI (Mistral or vLLM).
    - **AI Guess Loop**: A separate loop runs every few hundred milliseconds to evaluate new transcript segments.
    - **Player Voice Processing**: Each player's voice recording spawns a transient task to transcribe and "chunk" guesses from partial text.
- **Streaming Queues (`asyncio.Queue`)**:
    - Raw audio bytes are piped from WebSockets into per-participant `asyncio.Queue` objects, which the transcription service consumes. This decouples network I/O from AI processing.
- **Thread Offloading**:
    - **File I/O**: Saving audio recordings is offloaded to worker threads using `asyncio.to_thread` to prevent blocking the main event loop.

## 4. State Management

- **In-Memory**: `_room_states` keeps track of the current transcript, player lists, and previous guesses to provide context to the AI.
- **Persistence**: Every guess and game outcome is persisted to the database via async SQLAlchemy transactions, ensuring consistency even if a connection is lost.
