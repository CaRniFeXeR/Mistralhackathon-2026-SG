import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Mic, MicOff, Users } from 'lucide-react'
import { buildRoomWsUrl } from './ws'
import { useWebSocket } from './hooks/useWebSocket'
import { useAudioStream } from './hooks/useAudioStream'
import type { RoomInboundMessage } from './types/ws'
import GameOverScreen from './GameOverScreen'

export interface GameRoomPlayerProps {
  roomId: string
  token: string
}

interface GuessEntry {
  id: number
  text: string
  isWin: boolean
  source: 'AI' | 'human'
  userName: string
}

type GameState = 'WAITING' | 'PLAYING' | 'FINISHED'

export default function GameRoomPlayer({ roomId, token }: GameRoomPlayerProps) {
  const [gameState, setGameState] = useState<GameState>('WAITING')
  const [timeLeft, setTimeLeft] = useState(60)
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [guessHistory, setGuessHistory] = useState<GuessEntry[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [error, setError] = useState('')
  const [gameOverData, setGameOverData] = useState<{
    isWin: boolean
    targetWord: string
    reasonTitle: string
    reasonMessage: string
  } | null>(null)
  const [currentGuess, setCurrentGuess] = useState('')
  const [playerCount, setPlayerCount] = useState(0)
  const [playerNumber, setPlayerNumber] = useState<number | null>(null)
  const [playerBadgeBlink, setPlayerBadgeBlink] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [lastVoiceGuess, setLastVoiceGuess] = useState<string | null>(null)
  const guessCounter = useRef(0)
  const voiceStreamStatsRef = useRef({ frames: 0, bytes: 0 })
  const playerBadgeBlinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevPlayerCountRef = useRef(0)
  const prevPlayerNumberRef = useRef<number | null>(null)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const roomWsUrl = buildRoomWsUrl(roomId, token)

  const handleWsMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as RoomInboundMessage
        if (data.type === 'PLAYERS_UPDATE') {
          const count = Array.isArray(data.players) ? data.players.length : 0
          const myNum = data.yourPlayerNumber ?? null
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

          setGameOverData({ isWin, targetWord, reasonTitle, reasonMessage })
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
    [gameState],
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

  const handleSubmitGuess = (e: FormEvent) => {
    e.preventDefault()
    const guess = currentGuess.trim()
    if (!guess) return
    sendJson({ type: 'GUESS_SUBMIT', guess })
    setCurrentGuess('')
    setIsThinking(true)
  }

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

  const humanGuesses = guessHistory.filter((g) => g.source === 'human')
  const aiGuesses = guessHistory.filter((g) => g.source === 'AI')

  function GuessRow({
    g,
    totalInFeed,
    indexInFeed,
    isThinking,
  }: {
    g: GuessEntry
    totalInFeed: number
    indexInFeed: number
    isThinking: boolean
  }) {
    const isLatest = indexInFeed === 0 && !isThinking
    return (
      <div
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all ${g.isWin
          ? 'bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
          : isLatest
            ? 'bg-indigo-900/50 border-indigo-400/40'
            : 'bg-slate-800/40 border-slate-700/40'
          }`}
        style={{
          animation: indexInFeed === 0 ? 'guessPopIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both' : 'none',
        }}
      >
        {g.isWin ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        ) : (
          <span className="text-slate-500 text-xs font-mono w-4 text-right shrink-0">
            {totalInFeed - indexInFeed}
          </span>
        )}
        <span
          className={`font-bold tracking-wide text-base leading-tight ${g.isWin ? 'text-emerald-300' : isLatest ? 'text-indigo-100' : 'text-slate-400'
            }`}
        >
          {g.text}
          <span className="ml-2 text-xs text-slate-500">
            ({g.source === 'AI' ? 'AI' : g.userName || 'Player'})
          </span>
        </span>
        {g.isWin && (
          <span className="ml-auto text-xs text-emerald-400 font-semibold uppercase tracking-widest">
            ✓ Got it!
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      {gameState === 'FINISHED' && gameOverData && (
        <GameOverScreen
          isVictory={gameOverData.isWin}
          targetWord={gameOverData.targetWord}
          reasonTitle={gameOverData.reasonTitle}
          reasonMessage={gameOverData.reasonMessage}
        />
      )}

      {gameState !== 'FINISHED' && (
        <>
          <div className="flex justify-center mt-6">
            <span
              className={`inline-flex items-center gap-2 px-3 py-1 font-bold text-blue-400 border border-blue-500/50 bg-blue-900/20 transition-[box-shadow,background-color] duration-300 ${
                playerBadgeBlink ? 'player-badge-blink' : ''
              }`}
            >
              <Users className="w-4 h-4" />
              PLAYERS: {playerCount}
              {playerNumber != null && (
                <>
                  <span className="text-slate-500">|</span>
                  <span>YOU: #{playerNumber}</span>
                </>
              )}
            </span>
          </div>

          {error && (
            <div className="mb-4 border border-red-500 p-3 bg-red-900/20 text-red-400 font-bold flex gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>ERR: {error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
            <div className="ascii-border border-double p-4 relative flex flex-col h-[350px]">
              <div className="absolute -top-3 left-4 bg-black px-2 text-blue-500 text-sm font-bold tracking-widest">[ TARGET_ACQUISITION ]</div>
              <div className="text-center mt-4">
                <h2 className="text-4xl font-black mb-2 tracking-widest"><span className="text-slate-600">???</span></h2>
                <p className="text-slate-500 text-sm mb-4">
                  {gameState === 'WAITING' ? '> AWAITING_START_SIGNAL...' : '> RECEIVING_TRANSMISSION...'}
                </p>
              </div>

              <div className="mt-auto border-t border-dashed border-gray-800 pt-4 flex-1 flex flex-col min-h-0">
                <div className="flex items-center gap-2 mb-2 text-slate-500 text-xs border-b border-gray-800 pb-2">
                  <Mic className="w-3 h-3 text-red-500 animate-pulse" /> LIVE_AUDIO_FEED
                </div>
                <div className="flex-1 overflow-y-auto font-mono text-sm text-green-400 leading-relaxed uppercase pr-2">
                  {currentTranscript || (
                    <span className="text-slate-600 opacity-50">
                      {gameState === 'WAITING' ? '> AWAITING_GM...' : '> LISTENING...'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="ascii-border border-double p-4 relative flex flex-col h-[350px]">
              <div className="absolute -top-3 left-4 bg-black px-2 text-blue-500 text-sm font-bold tracking-widest">[ ANALYSIS_TERMINAL ]</div>

              <div className="mt-2 flex items-center justify-between border-b border-gray-800 pb-2 mb-2 shrink-0">
                <div className="flex items-center gap-2">
                  {isThinking && gameState === 'PLAYING' && (
                    <span className="text-indigo-400 text-xs animate-pulse font-bold tracking-widest">
                      &gt; PROCESSING...
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-blue-400 font-bold">
                  <span className={timeLeft <= 5 ? 'text-red-500 animate-pulse' : ''}>
                    T-{timeLeft.toString().padStart(2, '0')}s
                  </span>
                </div>
              </div>

              <div className="flex-1 flex min-h-0">
                <div className="flex-1 flex flex-col min-w-0 border-r border-gray-800 pr-2 mr-2">
                  <div className="text-amber-500 text-[10px] font-bold tracking-widest mb-2 shrink-0 border-b border-gray-800 pb-1">
                    HUMAN_GUESSES [{humanGuesses.length}]
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                    {humanGuesses.length === 0 && (
                      <p className="text-slate-700 text-xs py-2">&gt; NO_DATA</p>
                    )}
                    {humanGuesses.map((g, i) => (
                      <GuessRow key={g.id} g={g} totalInFeed={humanGuesses.length} indexInFeed={i} isThinking={isThinking} />
                    ))}
                  </div>
                </div>
                <div className="flex-1 flex flex-col min-w-0">
                  <div className="text-indigo-400 text-[10px] font-bold tracking-widest mb-2 shrink-0 border-b border-gray-800 pb-1">
                    AI_INFERENCE [{aiGuesses.length}]
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                    {aiGuesses.length === 0 && (
                      <p className="text-slate-700 text-xs py-2">&gt; NO_DATA</p>
                    )}
                    {aiGuesses.map((g, i) => (
                      <GuessRow key={g.id} g={g} totalInFeed={aiGuesses.length} indexInFeed={i} isThinking={isThinking} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full max-w-2xl space-y-4 pb-8">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1 border-b border-gray-800 pb-2">
              <span className="font-bold tracking-widest">
                INPUT_METHOD: <span className="text-blue-400">KEYBOARD</span> | <span className="text-blue-400">VOICE</span>
              </span>
              <span className="flex items-center gap-2">
                <span
                  className={`inline-flex h-2 w-2 ${gameState === 'PLAYING'
                    ? isRecording
                      ? 'bg-red-500 animate-pulse'
                      : 'bg-emerald-500'
                    : 'bg-slate-700'
                    }`}
                />
                <span className="uppercase tracking-widest font-bold">
                  {gameState !== 'PLAYING'
                    ? 'SYSTEM_LOCKED'
                    : isRecording
                      ? 'TRANSMITTING'
                      : 'READY'}
                </span>
              </span>
            </div>
            <form onSubmit={handleSubmitGuess} className="flex w-full items-center gap-3">
              <input
                type="text"
                value={currentGuess}
                onChange={(e) => setCurrentGuess(e.target.value)}
                placeholder="> ENTER_GUESS..."
                className="terminal-input w-full"
                disabled={gameState !== 'PLAYING'}
              />
              <button
                type="submit"
                disabled={gameState !== 'PLAYING' || !currentGuess.trim()}
                className="ascii-btn whitespace-nowrap !py-2"
              >
                &lt; TRANSMIT /&gt;
              </button>
              <button
                type="button"
                disabled={gameState !== 'PLAYING'}
                onClick={() => { void (isRecording ? stopRecording() : startRecording()) }}
                title={isRecording ? 'Stop speaking' : 'Speak your guess'}
                className={`ascii-border border-double p-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isRecording
                  ? 'text-red-500 bg-red-900/30 border-red-500 hover:bg-red-900/50'
                  : 'text-emerald-500 hover:bg-emerald-900/30 hover:text-emerald-400'
                  }`}
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            </form>

            {(isRecording || voiceTranscript) && (
              <div className="ascii-border border-double p-3 mt-4 text-emerald-400 bg-emerald-900/10">
                <div className="flex flex-col">
                  <span className="font-bold text-[10px] tracking-widest mb-1">
                    {isRecording ? '[ RECORDING_IN_PROGRESS ]' : '[ PROCESSING_AUDIO ]'}
                  </span>
                  <span className="font-mono text-sm uppercase">
                    {voiceTranscript || <span className="opacity-50">&gt; SPEAK_CLEARLY...</span>}
                  </span>
                </div>
              </div>
            )}

            {lastVoiceGuess && !isRecording && (
              <div className="flex items-center gap-2 border border-dashed border-gray-700 bg-black px-4 py-2 text-sm text-slate-400 font-mono mt-2">
                <Mic className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                <span>LAST_TRANSMISSION:</span>
                <span className="font-bold text-blue-400 uppercase">{lastVoiceGuess}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

