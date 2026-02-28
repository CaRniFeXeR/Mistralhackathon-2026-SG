export type { GuessEntry, GameOverData } from '../types/game'

export type GameState = 'PREPARING' | 'PLAYING' | 'FINISHED'

export interface GameRoomGMProps {
  roomId: string
  targetWord: string
  tabooWords?: string[]
  token: string
  onStateChange?: (state: GameState) => void
}
