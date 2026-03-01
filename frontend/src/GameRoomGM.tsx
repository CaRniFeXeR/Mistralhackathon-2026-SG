import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ChevronDown, Clock, Share2, User, Users } from 'lucide-react'
import { buildRoomWsUrl } from './ws'
import { useWebSocket } from './hooks/useWebSocket'
import { useAudioStream } from './hooks/useAudioStream'
import type { RoomInboundMessage } from './types/ws'
import GameOverScreen from './GameOverScreen'
import type { GameState, GuessEntry, GameOverData } from './gameRoomGM/types'
import type { GameRoomGMProps } from './gameRoomGM/types'
import { MODE_PROMPT, parseGameOverPayload, copyRoomLinkWithFallback } from './gameRoomGM/utils'
import GMGameOverActions from './gameRoomGM/GMGameOverActions'
import GMPlayingHeader from './gameRoomGM/GMPlayingHeader'
import GMVoicePanel from './gameRoomGM/GMVoicePanel'
import GMGuessesPanel from './gameRoomGM/GMGuessesPanel'
import GMDesktopTargetBlock from './gameRoomGM/GMDesktopTargetBlock'
import GMPlayersWithGuesses from './gameRoomGM/GMPlayersWithGuesses'
import LabeledPanel from './components/LabeledPanel'
import GuessFeedColumn from './gameRoomGM/GuessFeedColumn'
import { ASCII_PANEL_CLASS } from './gameRoomGM/utils'

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
    <div className="w-full space-y-6">
      {gameState === 'FINISHED' && gameOverData && (
        <GameOverScreen
          isVictory={gameOverData.isWin}
          targetWord={gameOverData.targetWord}
          reasonTitle={gameOverData.reasonTitle}
          reasonMessage={gameOverData.reasonMessage}
        >
          <GMGameOverActions
            roomId={roomId}
            newTargetWord={newTargetWord}
            newTabooWordsStr={newTabooWordsStr}
            onNewTargetWordChange={setNewTargetWord}
            onNewTabooWordsStrChange={setNewTabooWordsStr}
            onRestart={startNewGame}
          />
        </GameOverScreen>
      )}

      {gameState !== 'FINISHED' && (
        <>
          {/* Mobile layout: current design */}
          <div className="block md:hidden space-y-6">
            <GMPlayingHeader
              localTargetWord={localTargetWord}
              localTabooWords={localTabooWords}
              humanPlayers={humanPlayers}
              playersPopoverOpen={playersPopoverOpen}
              shareFeedback={shareFeedback}
              onPlayersPopoverToggle={() => setPlayersPopoverOpen((o) => !o)}
              onPlayersPopoverClose={() => setPlayersPopoverOpen(false)}
              onShare={handleShare}
            />

            <div className="flex justify-center mb-2">
              {gameState === 'PREPARING' && (
                <button type="button" onClick={startGame} className="ascii-btn w-full max-w-sm">
                  Start Game
                </button>
              )}
              {gameState === 'PLAYING' && (
                <button
                  type="button"
                  onClick={handleStop}
                  className="ascii-btn w-full max-w-sm !bg-red-600 !text-white"
                >
                  [ ABORT_OPERATION ]
                </button>
              )}
            </div>

            {error && (
              <div className="mb-4 border border-red-500 p-4 bg-red-900/20 text-red-400 font-bold flex gap-3 text-xl">
                <AlertCircle className="w-7 h-7 flex-shrink-0" />
                <span>Error: {error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 pb-8">
              <GMVoicePanel currentTranscript={currentTranscript} />
              <GMGuessesPanel
                humanGuesses={humanGuesses}
                aiGuesses={aiGuesses}
                isThinking={isThinking}
                gameState={gameState}
                timeLeft={timeLeft}
              />
            </div>
          </div>

          {/* Desktop layout: share + players below QR, then target, then 1/3 players + 2/3 transcript, then AI last 3 */}
          <div className="hidden md:block space-y-4">
            {/* Share link + Players + Start/Abort — right below QR session overview */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <div className="relative inline-block">
                <button
                  type="button"
                  onClick={() => setPlayersPopoverOpen((o) => !o)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-blue-400 border border-blue-500/50 bg-blue-900/20 hover:bg-blue-800/30 transition-colors"
                >
                  <Users className="w-4 h-4" />
                  <span>PLAYERS: {humanPlayers.length}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${playersPopoverOpen ? 'rotate-180' : ''}`} />
                </button>
                {playersPopoverOpen && (
                  <>
                    <div className="fixed inset-0 z-10" aria-hidden onClick={() => setPlayersPopoverOpen(false)} />
                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 min-w-[200px] py-2 bg-black border border-blue-500 shadow-xl">
                      {humanPlayers.length === 0 ? (
                        <p className="px-4 py-2 text-slate-500 text-base">No players yet</p>
                      ) : (
                        <ul className="text-left text-blue-300">
                          {humanPlayers.map((p, i) => (
                            <li key={i} className="flex items-center gap-2 px-4 py-2 hover:bg-blue-900/30 font-mono text-base">
                              <User className="w-4 h-4 text-blue-500" />
                              {p.name || 'Unknown'}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-emerald-400 border border-emerald-500/50 bg-emerald-900/20 hover:bg-emerald-800/30 transition-colors"
                title="Share room link"
              >
                <Share2 className="w-4 h-4" />
                <span>{shareFeedback === 'copied' ? 'LINK COPIED' : 'SHARE LINK'}</span>
              </button>

              {/* Start / Abort — 1/3 width, same visual size as before */}
              <div className="w-1/3 flex justify-center">
                {gameState === 'PREPARING' && (
                  <button type="button" onClick={startGame} className="ascii-btn w-full">
                    Start Game
                  </button>
                )}
                {gameState === 'PLAYING' && (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="ascii-btn w-full !bg-red-600 !text-white"
                  >
                    [ ABORT_OPERATION ]
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-center">
              <GMDesktopTargetBlock
                localTargetWord={localTargetWord}
                localTabooWords={localTabooWords}
              />
            </div>

            {error && (
              <div className="mb-4 border border-red-500 p-4 bg-red-900/20 text-red-400 font-bold flex gap-3 text-xl">
                <AlertCircle className="w-7 h-7 flex-shrink-0" />
                <span>Error: {error}</span>
              </div>
            )}

            <div className="grid grid-cols-[1fr_2fr] gap-6 min-h-0 flex-1">
              <div className="min-w-0 min-h-0 flex flex-col">
                <GMPlayersWithGuesses playersWithLastGuess={playersWithLastGuess} />
              </div>
              <div className="min-w-0 min-h-0 flex flex-col">
                <GMVoicePanel currentTranscript={currentTranscript} />
              </div>
            </div>

            <div className="pb-8">
              <LabeledPanel label="[ AI — last 3 ]" panelClassName={ASCII_PANEL_CLASS} className="!h-auto min-h-[140px]">
                <div className="mt-2 flex items-center justify-between border-b border-gray-800 pb-2 mb-2 shrink-0">
                  {isThinking && gameState === 'PLAYING' && (
                    <span className="text-indigo-400 text-base animate-pulse font-bold tracking-widest">
                      AI thinking...
                    </span>
                  )}
                  <div className="flex items-center gap-2 text-blue-400 text-2xl font-bold ml-auto">
                    <Clock className="w-6 h-6" />
                    <span className={timeLeft <= 5 ? 'text-red-500 animate-pulse' : ''}>
                      {timeLeft.toString().padStart(2, '0')}s
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                  <GuessFeedColumn
                    title="Recent"
                    titleClassName="text-indigo-400"
                    guesses={aiGuesses.slice(0, 3)}
                    isThinking={isThinking}
                  />
                </div>
              </LabeledPanel>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
