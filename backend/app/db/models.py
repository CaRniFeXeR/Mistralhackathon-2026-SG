"""
Schema definitions for SQLite tables: games, guesses.
"""

GAMES_TABLE = "games"
GUESSES_TABLE = "guesses"

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
    created_at TEXT NOT NULL,
    FOREIGN KEY (game_id) REFERENCES {GAMES_TABLE}(id)
)
"""
