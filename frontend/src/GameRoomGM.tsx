import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildRoomWsUrl } from './ws'
import { useWebSocket } from './hooks/useWebSocket'
import { useAudioStream } from './hooks/useAudioStream'
import type { RoomInboundMessage } from './types/ws'
import type { GameState, GuessEntry, GameOverData } from './gameRoomGM/types'
import type { GameRoomGMProps } from './gameRoomGM/types'
import { MODE_PROMPT, parseGameOverPayload, copyRoomLinkWithFallback } from './gameRoomGM/utils'
import GameRoomGMView from './gameRoomGM/GameRoomGMView'

export type { GameRoomGMProps, GameState }

export default function GameRoomGM({ roomId, targetWord, tabooWords, token, onStateChange, onNewGamePreparing }: GameRoomGMProps) {
  const [localTargetWord, setLocalTargetWord] = useState(targetWord)
  const [localTabooWords, setLocalTabooWords] = useState(tabooWords || [])
  const [newTargetWord, setNewTargetWord] = useState(targetWord)
  const [newTabooWordsStr, setNewTabooWordsStr] = useState((tabooWords || []).join(', '))

  const [gameState, setGameState] = useState<GameState>('PREPARING')
  const [timeLeft, setTimeLeft] = useState(60)
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [guessHistory, setGuessHistory] = useState<GuessEntry[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [error, setError] = useState('')
  const [gameOverData, setGameOverData] = useState<GameOverData | null>(null)
  const [humanPlayers, setHumanPlayers] = useState<{ name: string }[]>([])
  const [playersPopoverOpen, setPlayersPopoverOpen] = useState(false)
  const [shareFeedback, setShareFeedback] = useState<'copied' | null>(null)
  const guessCounter = useRef(0)

  const roomLink = `${window.location.origin}${window.location.pathname}#/room/${roomId}`

  const handleShare = useCallback(async () => {
    const result = await copyRoomLinkWithFallback(roomLink)
    if (result.ok) {
      setShareFeedback('copied')
      setTimeout(() => setShareFeedback(null), 2000)
    } else if (result.error) {
      setError(result.error)
    }
  }, [roomLink])

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const gameStateRef = useRef<GameState>('PREPARING')
  const guessHistoryRef = useRef<GuessEntry[]>([])
  const prevPlayerCountRef = useRef<number | null>(null)

  const playJoinSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const playTone = (frequency: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = frequency
        osc.type = 'sine'
        gain.gain.setValueAtTime(0.15, startTime)
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration)
        osc.start(startTime)
        osc.stop(startTime + duration)
      }
      playTone(523, 0, 0.08)
      playTone(659, 0.1, 0.12)
    } catch {
      // ignore if AudioContext not supported or autoplay blocked
    }
  }, [])

  const playFightStartSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const playDing = (frequency: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = frequency
        osc.type = 'sine'
        gain.gain.setValueAtTime(0.2, startTime)
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration)
        osc.start(startTime)
        osc.stop(startTime + duration)
      }
      playDing(700, 0, 0.1)
      playDing(800, 0.15, 0.1)
    } catch {
      // ignore if AudioContext not supported or autoplay blocked
    }
  }, [])

  const playFightEndSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const playDing = (frequency: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = frequency
        osc.type = 'sine'
        gain.gain.setValueAtTime(0.2, startTime)
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration)
        osc.start(startTime)
        osc.stop(startTime + duration)
      }
      playDing(650, 0, 0.12)
      playDing(600, 0.18, 0.12)
    } catch {
      // ignore if AudioContext not supported or autoplay blocked
    }
  }, [])

  const cleanupAudioOnly = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const cleanupAudioAndConnection = useCallback(() => {
    cleanupAudioOnly()
    gameStateRef.current = 'PREPARING'
  }, [cleanupAudioOnly])

  const roomWsUrl = buildRoomWsUrl(roomId, token)

  const handleWsMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as RoomInboundMessage
        if (data.type === 'PLAYERS_UPDATE') {
          const nextPlayers = Array.isArray(data.players) ? data.players : []
          const nextCount = nextPlayers.length
          if (prevPlayerCountRef.current !== null && nextCount > prevPlayerCountRef.current) {
            playJoinSound()
          }
          prevPlayerCountRef.current = nextCount
          setHumanPlayers(nextPlayers)
        } else if (data.type === 'TRANSCRIPT_UPDATE') {
          setCurrentTranscript(data.transcript as string)
        } else if (data.type === 'AI_GUESS' || data.type === 'HUMAN_GUESS') {
          const guessText = data.guess as string
          const id = ++guessCounter.current
          const isWin = Boolean(data.isWin)
          const source = (data.type === 'AI_GUESS' ? 'AI' : 'human') as 'AI' | 'human'
          const userName = (data.userName as string) ?? (source === 'AI' ? 'AI' : 'Player')
          const entry: GuessEntry = { id, text: guessText, isWin, source, userName }
          guessHistoryRef.current = [entry, ...guessHistoryRef.current]
          setGuessHistory([...guessHistoryRef.current])
          setIsThinking(!isWin && gameStateRef.current === 'PLAYING')
        } else if (data.type === 'NEW_GAME_PREPARING') {
          setLocalTargetWord(data.targetWord as string)
          setLocalTabooWords(data.tabooWords as string[])
          setNewTargetWord(data.targetWord as string)
          setNewTabooWordsStr((data.tabooWords || []).join(', '))
          setGameState('PREPARING')
          gameStateRef.current = 'PREPARING'
          setCurrentTranscript('')
          setGuessHistory([])
          guessHistoryRef.current = []
          setGameOverData(null)
          cleanupAudioOnly()
          onNewGamePreparing?.()
        } else if (data.type === 'GAME_OVER') {
          setGameOverData(parseGameOverPayload(data))
          setGameState('FINISHED')
          gameStateRef.current = 'FINISHED'
          setIsThinking(false)
          cleanupAudioOnly()
          playFightEndSound()
        }
      } catch (e) {
        console.error('[WS ROOM GM] Error parsing message:', e, 'raw:', event.data)
      }
    },
    [playJoinSound, playFightEndSound, cleanupAudioOnly, onNewGamePreparing]
  )

  const { sendJson, sendBinary, close, readyState } = useWebSocket(roomWsUrl, {
    onError: () => {
      setError('WebSocket connection failed. Ensure backend is running.')
    },
    onMessage: handleWsMessage,
    onClose: (e: CloseEvent) => {
      console.log('[WS ROOM GM] Closed', e.code, e.reason, e.wasClean)
    },
  })

  const { start: startAudio, stop: stopAudio, error: audioError } = useAudioStream({
    onAudioFrame: (pcm16) => {
      if (readyState !== WebSocket.OPEN) return
      if (gameStateRef.current !== 'PLAYING') return
      sendBinary(pcm16)
    },
  })

  useEffect(() => {
    if (audioError) setError(audioError)
  }, [audioError])

  useEffect(() => {
    onStateChange?.(gameState)
  }, [gameState, onStateChange])

  useEffect(() => {
    return () => {
      cleanupAudioAndConnection()
      close()
    }
  }, [cleanupAudioAndConnection, close])

  const startGame = useCallback(async () => {
    setError('')
    playFightStartSound()
    setGameOverData(null)
    guessCounter.current = 0
    guessHistoryRef.current = []
    setGuessHistory([])
    setGameState('PLAYING')
    gameStateRef.current = 'PLAYING'
    setTimeLeft(60)
    setCurrentTranscript('')

    try {
      if (readyState !== WebSocket.OPEN) throw new Error('WebSocket is not connected')
      sendJson({ type: 'START_GAME', prompt: MODE_PROMPT })
      setIsThinking(true)
      await startAudio()
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            sendJson({ type: 'TIME_UP' })
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err) {
      console.error('Setup error:', err)
      setError('Microphone access denied or audio issue.')
      cleanupAudioOnly()
      setGameState('PREPARING')
      gameStateRef.current = 'PREPARING'
    }
  }, [readyState, sendJson, startAudio, cleanupAudioOnly, playFightStartSound])

  const handleStop = useCallback(() => {
    cleanupAudioOnly()
    stopAudio()
    setGameState('PREPARING')
    gameStateRef.current = 'PREPARING'
  }, [cleanupAudioOnly, stopAudio])

  const startNewGame = useCallback(() => {
    if (readyState !== WebSocket.OPEN) {
      setError('Connection lost. Please refresh the page.')
      return
    }
    const tabooArray = newTabooWordsStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    sendJson({ type: 'NEW_GAME', target_word: newTargetWord, taboo_words: tabooArray })
  }, [readyState, newTargetWord, newTabooWordsStr, sendJson])

  const humanGuesses = guessHistory.filter((g) => g.source === 'human')
  const aiGuesses = guessHistory.filter((g) => g.source === 'AI')

  const playersWithLastGuess = useMemo(
    () =>
      humanPlayers.map((p) => ({
        name: p.name,
        lastGuess: humanGuesses.find((g) => g.userName === p.name),
      })),
    [humanPlayers, humanGuesses]
  )

  return (
    <GameRoomGMView
      roomId={roomId}
      gameState={gameState}
      gameOverData={gameOverData}
      localTargetWord={localTargetWord}
      localTabooWords={localTabooWords}
      humanPlayers={humanPlayers}
      playersPopoverOpen={playersPopoverOpen}
      shareFeedback={shareFeedback}
      error={error}
      currentTranscript={currentTranscript}
      humanGuesses={humanGuesses}
      aiGuesses={aiGuesses}
      isThinking={isThinking}
      timeLeft={timeLeft}
      playersWithLastGuess={playersWithLastGuess}
      newTargetWord={newTargetWord}
      newTabooWordsStr={newTabooWordsStr}
      onPlayersPopoverToggle={() => setPlayersPopoverOpen((open) => !open)}
      onPlayersPopoverClose={() => setPlayersPopoverOpen(false)}
      onShare={() => {
        void handleShare()
      }}
      onStartGame={() => {
        void startGame()
      }}
      onAbortGame={handleStop}
      onNewTargetWordChange={setNewTargetWord}
      onNewTabooWordsStrChange={setNewTabooWordsStr}
      onRestart={startNewGame}
    />
  )
}
