export interface GuessEntry {
  id: number
  text: string
  isWin: boolean
  source: 'AI' | 'human'
  userName: string
}

export interface GameOverData {
  isWin: boolean
  targetWord: string
  reasonTitle: string
  reasonMessage: string
}
