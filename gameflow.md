# 🎮 Game Flow — Taboo AI

> A real-time, multiplayer Taboo-style game where **human players** and an **AI guesser** race to identify the secret word from the Game Master's live spoken clues — before time runs out.

---

## Roles

### 🎙️ Game Master (GM)
- One human per room.
- Holds the mobile device (or desktop) that shows the **target word** and its **forbidden (taboo) words**.
- Speaks clues out loud — their microphone audio is streamed live to the backend.
- **Must NOT say** the target word or any of the taboo words.
- Presses **START GAME** to begin a round and can abort it at any time.

### 🤖 AI Guesser (Mistral AI)
- Runs server-side — no human controls it.
- Listens to the **real-time transcription** of the GM's speech.
- Every ~600 ms it receives the latest transcript delta and generates a guess.
- Maintains a multi-turn chat history across the round so it learns from prior incorrect guesses and doesn't repeat them.

### 👥 Human Players
- Any number of participants who join by scanning/opening the **room link or QR code**.
- Watch the live transcript on their own screen.
- Submit guesses by:
  - **Typing** a guess and pressing submit (`GUESS_SUBMIT`), or
  - **Speaking** — player voice is transcribed and guesses are extracted word-by-word.
- The human player list is broadcast to everyone (including the GM) when someone joins or leaves.

---

## Rooms

| Property | Details |
|---|---|
| **Room ID** | Short unique code generated when the GM creates the room |
| **Target Word** | The secret word the GM must get others to guess |
| **Taboo Words** | A list of forbidden words the GM cannot say |
| **Status** | `waiting` → `started` → `won` / `lost` |

Rooms persist in the database (`Room`, `RoomMember`, `RoomGame`, `Guess` tables via SQLAlchemy).  
Each round within a room is recorded as a separate `RoomGame` row.

---

## Rules

1. **The GM may not say** the target word or any taboo word. If they do, the game ends immediately — **GM Lost / Taboo Violation**.
2. **The timer counts down from 60 seconds.** If no one guesses correctly before time is up, all players lose.
3. **First correct guess wins**, whether it comes from an AI or a human player.
4. **AI vs Humans compete simultaneously** throughout the round.
5. Single-word targets match their plural forms (e.g. *shoe* matches *shoes*).
6. Multi-word targets must appear as a bounded phrase in the guess.
7. Incorrect human guesses are fed back into the AI's conversation history so it avoids repeating them.

---

## Game Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                          LOBBY / SETUP                               │
│                                                                      │
│  GM opens the app → views instructions → selects "Game Master" role │
│  → creates a room (target word + taboo words generated / set)        │
│  → room link / QR code displayed                                     │
│                                                                      │
│  Players open the link → select "Player" role → enter their name    │
│  → join the room via WebSocket                                       │
│  ← GM sees player list update in real time                           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        PREPARING STATE                               │
│                                                                      │
│  GM screen shows:                                                    │
│    • Target word (visible only to GM)                                │
│    • Taboo words in red                                              │
│    • Connected player list                                           │
│    • "START GAME" button                                             │
│                                                                      │
│  Players see: waiting for GM to start                                │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  GM presses START GAME
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         PLAYING STATE                                │
│                                                                      │
│  1. Frontend sends  START_GAME  message over WebSocket               │
│  2. Backend marks room as started, inserts a RoomGame record        │
│  3. Backend broadcasts  GAME_STARTED  to all connections            │
│  4. 60-second countdown begins on GM screen                         │
│                                                                      │
│  ┌──────────────────┐     PCM-16 audio frames    ┌───────────────┐  │
│  │   GM Microphone  │ ─────────────────────────► │   Backend     │  │
│  └──────────────────┘                             │               │  │
│                                                   │  Mistral STT  │  │
│                          TRANSCRIPT_UPDATE ◄───── │  (streaming)  │  │
│                          (broadcasted to all)     └───────┬───────┘  │
│                                                           │           │
│                                         every ~600 ms    │           │
│                                                           ▼           │
│                                                   ┌───────────────┐  │
│                                                   │ Mistral LLM   │  │
│                                                   │  (guesser)    │  │
│                                                   └───────┬───────┘  │
│                                                           │           │
│                        AI_GUESS  ◄────────────────────────┘           │
│                        (broadcasted to all)                           │
│                                                                      │
│  Meanwhile, players:                                                 │
│    • Read the live transcript on their screen                        │
│    • Type a guess → GUESS_SUBMIT → _process_guess()                  │
│    • OR speak → voice transcribed → words extracted → _process_guess │
│    • HUMAN_GUESS event broadcasted to all                            │
│                                                                      │
│  Taboo check: every transcript update checks for forbidden words     │
│    → violation triggers immediate GAME_OVER (gm_lost)               │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  First correct guess OR timer → 0 OR taboo
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          GAME OVER                                   │
│                                                                      │
│  Outcome broadcast:  GAME_OVER  message includes:                    │
│    • winnerType: "human" | "AI" | "time_up" | "gm_lost"            │
│    • winnerDisplayName, winningGuess, targetWord, durationSeconds    │
│                                                                      │
│  Victory screen shown to all players and the GM.                    │
│                                                                      │
│  Outcome recorded in DB:                                             │
│    Room → status won/lost                                            │
│    RoomGame → ended_at, winner_type, winning_guess, final_transcript │
│    Guess rows → each guess stored with source (human/AI) & is_win   │
│                                                                      │
│  Ticker endpoint (/api/ticker/text) reflects result immediately:     │
│    🏆 Humans Win  (icon 49174) or  🤖 AI Wins  (icon 19663)         │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  GM presses NEW GAME
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         NEW GAME / RESET                             │
│                                                                      │
│  GM (optionally) edits target word + taboo words, then confirms.    │
│  Frontend sends  NEW_GAME  message.                                  │
│  Backend:                                                            │
│    • Cancels old game task, flushes audio buffers                    │
│    • Resets room state (transcript, winner, started_at)              │
│    • Updates DB (reset_room_for_new_game)                            │
│    • Broadcasts  NEW_GAME_PREPARING  to all connections              │
│  → All screens return to PREPARING state, ready for next round      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## WebSocket Message Reference

| Message | Direction | Sender | Description |
|---|---|---|---|
| `START_GAME` | Client → Server | GM | Kicks off the game loop |
| `GAME_STARTED` | Server → All | Backend | Confirms game is live |
| `TRANSCRIPT_UPDATE` | Server → All | Backend | Latest GM speech transcript |
| `AI_GUESS` | Server → All | Backend (AI) | AI's current guess attempt |
| `HUMAN_GUESS` | Server → All | Backend | A player's guess (typed or spoken) |
| `GUESS_SUBMIT` | Client → Server | Player | Player submits a typed guess |
| `VOICE_TRANSCRIPT` | Server → Player | Backend | Player's own voice transcript (live) |
| `VOICE_GUESS_SUBMITTED` | Server → Player | Backend | Final word(s) extracted from voice |
| `PLAYER_AUDIO_STOP` | Client → Server | Player | Signals end of a voice recording |
| `PLAYERS_UPDATE` | Server → All | Backend | Current human player list |
| `TIME_UP` | Client → Server | GM | Frontend timer reached zero |
| `GAME_OVER` | Server → All | Backend | Round ended (with outcome metadata) |
| `NEW_GAME` | Client → Server | GM | Request a new round |
| `NEW_GAME_PREPARING` | Server → All | Backend | Announce new target + taboo words |

---

## Win / Loss Conditions

| Condition | Winner | Notes |
|---|---|---|
| Human player guesses correctly first | 🧑 **Human Win** | |
| AI guesses correctly first | 🤖 **AI Win** | |
| 60-second timer expires | 💀 **Time Up** (all lose) | GM sends `TIME_UP` |
| GM says a taboo word | 💥 **GM Lost** | Taboo violation detected in transcript |

---

## Tech Notes

- **Transcription**: Mistral Realtime API (or local vLLM with the `AI_MODE=vllm` flag).
- **Guessing**: Mistral LLM (chat completion) using a server-side system prompt — no target word is ever sent to the client.
- **Win matching**: Plural-aware, punctuation-stripped, word-boundary regex. `shoe` matches `shoes`.
- **Human voice guessing**: Transcript is chunked by word boundaries with a 400 ms silence gap before emission, up to 20 guesses per recording.
- **AI guess history**: Shared multi-turn `chat_history` list. Incorrect human guesses are injected so the AI doesn't repeat them.
- **Audio recording**: GM audio is written to `DATA_DIR/audio/game_{room_id}_{timestamp}.raw` in 500 KB chunks.
