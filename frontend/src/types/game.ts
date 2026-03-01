export interface GuessEntry {
  id: number
  text: string
  isWin: boolean
  source: 'AI' | 'human'
  userName: string
}

export type GameOverOutcome = 'you_won' | 'other_human_won' | 'ai_won' | 'defeat' | 'time_up' | 'gm_lost'

export interface GameOverData {
  isWin: boolean
  targetWord: string
  reasonTitle: string
  reasonMessage: string
  /** When set, GameOverScreen shows: you_won → HUMANS WIN (you!), other_human_won → HUMANS WIN (but not you), ai_won → AI WINS, defeat → DEFEAT */
  outcome?: GameOverOutcome
}
