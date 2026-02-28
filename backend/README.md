# Backend Architecture

This backend is a FastAPI service for a Taboo-style game with two play modes:
- single game over WebSocket (`/ws/game`)
- room-based multiplayer over REST + WebSocket (`/api/rooms`, `/ws/room/{room_id}`)

It uses SQLite (via SQLAlchemy async ORM) and Mistral APIs for real-time transcription and AI guessing.

## High-Level Components

- `app/main.py`: app bootstrap, CORS, DB init, and router registration.
- `app/api/rooms.py`: REST endpoints for room create/join/info and token-backed room context checks.
- `app/api/ws_game.py`: legacy single-game WebSocket endpoint (config + audio ingestion).
- `app/api/ws_room.py`: room WebSocket coordination (connections, broadcasts, guesses, game outcome updates).
- `app/services/game_service.py`: core game loops (transcription stream + periodic AI guess loop).
- `app/services/mistral_service.py`: thin Mistral wrapper for transcription stream and chat-based word guessing.
- `app/db/connection.py`: async engine/session factory and DB initialization.
- `app/db/repository.py`: data access layer for games, rooms, guesses, and room members.
- `app/db/models.py`: SQLAlchemy ORM schema.

## Runtime Flow

```mermaid
flowchart TD
client[FrontendClient] -->|POST/GET /api/rooms| roomsApi[rooms.py]
client -->|WS /ws/game| wsGame[ws_game.py]
client -->|WS /ws/room/{room_id}| wsRoom[ws_room.py]
wsGame --> gameSvc[game_service.py]
wsRoom --> gameSvc
gameSvc --> mistralSvc[mistral_service.py]
roomsApi --> repo[db/repository.py]
wsRoom --> repo
gameSvc --> repo
repo --> sqlite[(SQLite games.db)]
```

## Notes

- API routers are intentionally thin: orchestration logic lives in services/repository layers.
- `game_service.py` is shared by both single-game and room mode to keep game-loop behavior consistent.
- Room auth uses JWT claims (`room_id`, `role`, `name`, `sub`) validated before room WebSocket participation.
