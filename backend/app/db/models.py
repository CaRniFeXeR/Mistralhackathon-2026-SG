"""
Schema definitions for SQLite tables.

Legacy tables:
- games, guesses

New tables:
- rooms, room_members
"""

GAMES_TABLE = "games"
GUESSES_TABLE = "guesses"
ROOMS_TABLE = "rooms"
ROOM_MEMBERS_TABLE = "room_members"

CREATE_GAMES = f"""
CREATE TABLE IF NOT EXISTS {GAMES_TABLE} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_word TEXT NOT NULL,
    taboo_words TEXT NOT NULL,
    outcome TEXT NOT NULL,
    time_remaining_seconds INTEGER,
    final_transcript TEXT,
    winning_guess TEXT,
    started_at TEXT NOT NULL,
    ended_at TEXT
)
"""

CREATE_GUESSES = f"""
CREATE TABLE IF NOT EXISTS {GUESSES_TABLE} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    guess_text TEXT NOT NULL,
    is_win INTEGER NOT NULL,
    -- Optional attribution fields (may be NULL for legacy rows)
    user_id TEXT,
    display_name TEXT,
    source TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (game_id) REFERENCES {GAMES_TABLE}(id)
)
"""

CREATE_ROOMS = f"""
CREATE TABLE IF NOT EXISTS {ROOMS_TABLE} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_user_id TEXT NOT NULL,
    target_word TEXT NOT NULL,
    taboo_words TEXT NOT NULL,
    status TEXT NOT NULL,
    time_remaining_seconds INTEGER,
    final_transcript TEXT,
    winning_guess TEXT,
    winner_type TEXT,
    winner_user_id TEXT,
    winner_display_name TEXT,
    started_at TEXT,
    ended_at TEXT,
    created_at TEXT NOT NULL
)
"""

CREATE_ROOM_MEMBERS = f"""
CREATE TABLE IF NOT EXISTS {ROOM_MEMBERS_TABLE} (
    room_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    joined_at TEXT NOT NULL,
    PRIMARY KEY (room_id, user_id),
    FOREIGN KEY (room_id) REFERENCES {ROOMS_TABLE}(id)
)
"""
