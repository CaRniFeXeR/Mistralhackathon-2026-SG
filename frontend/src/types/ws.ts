export type RoomInboundMessage =
  | {
      type: 'PLAYERS_UPDATE'
      players: { name: string }[]
    }
  | {
      type: 'TRANSCRIPT_UPDATE'
      transcript: string
    }
  | {
      type: 'AI_GUESS' | 'HUMAN_GUESS'
      guess: string
      isWin?: boolean
      userName?: string
    }
  | {
      type: 'VOICE_TRANSCRIPT'
      transcript: string
    }
  | {
      type: 'VOICE_GUESS_SUBMITTED'
      guess: string
    }
  | {
      type: 'NEW_GAME_PREPARING'
      targetWord: string
      tabooWords: string[]
    }
  | {
      type: 'GAME_STARTED'
    }
  | {
      type: 'GAME_OVER'
      winnerType?: string
      tabooViolation?: boolean
      winnerDisplayName?: string
      winningGuess?: string
    }

export type GameInboundMessage =
  | {
      type: 'TRANSCRIPT_UPDATE'
      transcript: string
    }
  | {
      type: 'GAME_OVER'
      tabooViolation?: boolean
    }
  | {
      type: 'AI_GUESS'
      guess: string
    }

