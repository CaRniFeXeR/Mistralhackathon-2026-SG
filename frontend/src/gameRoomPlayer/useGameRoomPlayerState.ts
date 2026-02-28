import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { buildRoomWsUrl } from '../ws'
import { useWebSocket } from '../hooks/useWebSocket'
import { useAudioStream } from '../hooks/useAudioStream'
import type { RoomInboundMessage } from '../types/ws'
import type { GameOverOutcome } from '../types/game'
import type { GameState } from './types'
import type { GuessEntry, GameOverData } from './types'

export interface UseGameRoomPlayerStateParams {
  roomId: string
  token: string
  onNewGamePreparing?: () => void
}

export interface UseGameRoomPlayerStateResult {
  state: {
    gameState: GameState
    timeLeft: number
    currentTranscript: string
    guessHistory: GuessEntry[]
    guessExcerpt: GuessEntry[]
    isThinking: boolean
    error: string
    gameOverData: GameOverData | null
    currentGuess: string
    playerCount: number
    playerNumber: number | null
    playerBadgeBlink: boolean
    voiceTranscript: string
    lastVoiceGuess: string | null
    isGuessInputFocused: boolean
    isRecording: boolean
  }
  handlers: {
    setCurrentGuess: (v: string) => void
    setIsGuessInputFocused: (v: boolean) => void
    handleSubmitGuess: (e: FormEvent) => void
    startRecording: () => Promise<void>
    stopRecording: () => void
  }
  refs: {
    guessInputRef: React.RefObject<HTMLInputElement | null>
  }
  sendJson: (data: unknown) => void
  readyState: number
}

const LAST_GUESSES_EXCERPT = 5

export function useGameRoomPlayerState({
  roomId,
  token,
  onNewGamePreparing,
}: UseGameRoomPlayerStateParams): UseGameRoomPlayerStateResult {
  const [gameState, setGameState] = useState<GameState>('WAITING')
  const [timeLeft, setTimeLeft] = useState(60)
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [guessHistory, setGuessHistory] = useState<GuessEntry[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [error, setError] = useState('')
  const [gameOverData, setGameOverData] = useState<GameOverData | null>(null)
  const [currentGuess, setCurrentGuess] = useState('')
  const [playerCount, setPlayerCount] = useState(0)
  const [playerNumber, setPlayerNumber] = useState<number | null>(null)
  const [playerBadgeBlink, setPlayerBadgeBlink] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [lastVoiceGuess, setLastVoiceGuess] = useState<string | null>(null)
  const [isGuessInputFocused, setIsGuessInputFocused] = useState(false)
  const guessCounter = useRef(0)
  const voiceStreamStatsRef = useRef({ frames: 0, bytes: 0 })
  const playerBadgeBlinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevPlayerCountRef = useRef(0)
  const prevPlayerNumberRef = useRef<number | null>(null)
  const myDisplayNameRef = useRef('')
  const guessInputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const roomWsUrl = buildRoomWsUrl(roomId, token)

  const handleWsMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as RoomInboundMessage
        if (data.type === 'PLAYERS_UPDATE') {
          const count = Array.isArray(data.players) ? data.players.length : 0
          const myNum = data.yourPlayerNumber ?? null
          const players = Array.isArray(data.players) ? data.players : []
          const myName = myNum != null && myNum >= 1 ? (players[myNum - 1] as { name?: string } | undefined)?.name ?? '' : ''
          myDisplayNameRef.current = myName
          const prevCount = prevPlayerCountRef.current
          const prevNum = prevPlayerNumberRef.current
          const changed = prevCount !== count || prevNum !== myNum
          const hadPrevious = prevCount > 0 || prevNum !== null
          prevPlayerCountRef.current = count
          prevPlayerNumberRef.current = myNum
          setPlayerCount(count)
          setPlayerNumber(myNum)
          if (changed && hadPrevious) {
            setPlayerBadgeBlink(true)
            if (playerBadgeBlinkTimeoutRef.current) clearTimeout(playerBadgeBlinkTimeoutRef.current)
            playerBadgeBlinkTimeoutRef.current = setTimeout(() => setPlayerBadgeBlink(false), 800)
          }
        } else if (data.type === 'TRANSCRIPT_UPDATE') {
          setCurrentTranscript(data.transcript as string)
        } else if (data.type === 'AI_GUESS' || data.type === 'HUMAN_GUESS') {
          const guessText = data.guess as string
          const id = ++guessCounter.current
          const isWin = Boolean(data.isWin)
          const source = (data.type === 'AI_GUESS' ? 'AI' : 'human') as 'AI' | 'human'
          const userName = (data.userName as string | undefined) ?? (source === 'AI' ? 'AI' : 'Player')
          const entry: GuessEntry = { id, text: guessText, isWin, source, userName }
          setGuessHistory((prev: GuessEntry[]) => [entry, ...prev])
          console.log('[WS ROOM PLAYER] Guess event', { type: data.type, guess: guessText, userName, isWin })
          setIsThinking(!isWin && gameState === 'PLAYING')
        } else if (data.type === 'VOICE_TRANSCRIPT') {
          setVoiceTranscript(data.transcript as string)
          console.log('[WS ROOM PLAYER] VOICE_TRANSCRIPT', { length: String(data.transcript ?? '').length })
        } else if (data.type === 'VOICE_GUESS_SUBMITTED') {
          setLastVoiceGuess(data.guess as string)
          setVoiceTranscript('')
          console.log('[WS ROOM PLAYER] VOICE_GUESS_SUBMITTED', { guess: data.guess })
        } else if (data.type === 'NEW_GAME_PREPARING') {
          setGameState('WAITING')
          setCurrentTranscript('')
          setGuessHistory([])
          setGameOverData(null)
          setLastVoiceGuess(null)
          setVoiceTranscript('')
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          onNewGamePreparing?.()
        } else if (data.type === 'GAME_STARTED') {
          setGameState('PLAYING')
          setTimeLeft(60)
          timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
              if (prev <= 1) {
                return 0
              }
              return prev - 1
            })
          }, 1000)
        } else if (data.type === 'GAME_OVER') {
          const winnerType = data.winnerType as string | undefined
          const tabooViolation = Boolean(data.tabooViolation)
          const winnerDisplayName = (data.winnerDisplayName as string | undefined) ?? ''
          const winningGuess = (data.winningGuess as string | undefined) ?? ''
          const targetWord = (data.targetWord as string | undefined) ?? ''

          let isWin = false
          let reasonTitle = 'OUTCOME'
          let reasonMessage = 'GAME OVER'

          if (winnerType === 'gm_lost' || tabooViolation) {
            isWin = false
            reasonTitle = 'FATAL ERROR'
            reasonMessage = 'TABOO WORD DETECTED'
          } else if (winnerType === 'time_up') {
            isWin = false
            reasonTitle = 'TIME LIMIT REACHED'
            reasonMessage = "TIME'S UP"
          } else if (winnerType && winningGuess) {
            isWin = true
            reasonTitle = 'WINNING GUESS'
            reasonMessage = `"${winningGuess}" BY ${winnerType === 'AI' ? 'AI' : winnerDisplayName || 'PLAYER'}`
          }

          let outcome: GameOverOutcome = 'defeat'
          if (winnerType === 'gm_lost' || tabooViolation || winnerType === 'time_up') {
            outcome = 'defeat'
          } else if (winnerType === 'AI') {
            outcome = 'ai_won'
          } else if (winnerType && winningGuess) {
            const myName = myDisplayNameRef.current
            outcome = winnerDisplayName.trim() && myName && winnerDisplayName.trim() === myName.trim() ? 'you_won' : 'other_human_won'
          }

          setGameOverData({ isWin, targetWord, reasonTitle, reasonMessage, outcome })
          setGameState('FINISHED')
          setIsThinking(false)
          setVoiceTranscript('')
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
        }
      } catch (e) {
        console.error('[WS ROOM PLAYER] Error parsing message:', e, 'raw:', event.data)
      }
    },
    [gameState, onNewGamePreparing],
  )

  const { sendJson, sendBinary, close, readyState } = useWebSocket(roomWsUrl, {
    onOpen: () => {
      setError('')
      console.log('[WS ROOM PLAYER] Open', { roomId })
    },
    onMessage: handleWsMessage,
    onError: () => {
      setError('WebSocket connection failed. Ensure backend is running.')
    },
    onClose: (e: CloseEvent) => {
      console.log('[WS ROOM PLAYER] Closed', e.code, e.reason, e.wasClean)
    },
  })

  const {
    start: startAudio,
    stop: stopAudio,
    isRecording,
    error: audioError,
  } = useAudioStream({
    onAudioFrame: (pcm16) => {
      if (readyState !== WebSocket.OPEN) return
      sendBinary(pcm16)
      const stats = voiceStreamStatsRef.current
      stats.frames += 1
      stats.bytes += pcm16.byteLength
      if (stats.frames % 20 === 0) {
        console.log('[VOICE PLAYER] Streaming audio', {
          frames: stats.frames,
          bytes: stats.bytes,
          readyState,
        })
      }
    },
  })

  useEffect(() => {
    if (audioError) {
      setError(audioError)
    }
  }, [audioError])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (playerBadgeBlinkTimeoutRef.current) {
        clearTimeout(playerBadgeBlinkTimeoutRef.current)
      }
      stopAudio()
      close()
    }
  }, [close, stopAudio])

  const handleSubmitGuess = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      const guess = currentGuess.trim()
      if (!guess) return
      sendJson({ type: 'GUESS_SUBMIT', guess })
      setCurrentGuess('')
      setIsThinking(true)
    },
    [currentGuess, sendJson],
  )

  const startRecording = useCallback(async () => {
    if (readyState !== WebSocket.OPEN) return
    voiceStreamStatsRef.current = { frames: 0, bytes: 0 }
    console.log('[VOICE PLAYER] Start recording')
    await startAudio()
    setVoiceTranscript('')
  }, [readyState, startAudio])

  const stopRecording = useCallback(() => {
    stopAudio()
    console.log('[VOICE PLAYER] Stop recording', voiceStreamStatsRef.current)
    sendJson({ type: 'PLAYER_AUDIO_STOP' })
  }, [sendJson, stopAudio])

  useEffect(() => {
    if (gameState !== 'PLAYING' && isRecording) {
      stopRecording()
    }
  }, [gameState, isRecording, stopRecording])

  useEffect(() => {
    if (gameState === 'PLAYING') {
      const t = setTimeout(() => guessInputRef.current?.focus(), 100)
      return () => clearTimeout(t)
    }
  }, [gameState])

  const guessExcerpt = guessHistory.slice(0, LAST_GUESSES_EXCERPT)

  return {
    state: {
      gameState,
      timeLeft,
      currentTranscript,
      guessHistory,
      guessExcerpt,
      isThinking,
      error,
      gameOverData,
      currentGuess,
      playerCount,
      playerNumber,
      playerBadgeBlink,
      voiceTranscript,
      lastVoiceGuess,
      isGuessInputFocused,
      isRecording,
    },
    handlers: {
      setCurrentGuess,
      setIsGuessInputFocused,
      handleSubmitGuess,
      startRecording,
      stopRecording,
    },
    refs: { guessInputRef },
    sendJson,
    readyState,
  }
}
