export type GameState = 'PREPARING' | 'PLAYING' | 'FINISHED'

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

export interface GameRoomGMProps {
  roomId: string
  targetWord: string
  tabooWords?: string[]
  token: string
  onStateChange?: (state: GameState) => void
}
