import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Brain, CheckCircle2, Clock, Mic, MicOff, Send, User, Users } from 'lucide-react'

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
  const [winnerMessage, setWinnerMessage] = useState<string | null>(null)
  const [currentGuess, setCurrentGuess] = useState('')
  const [playerCount, setPlayerCount] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [lastVoiceGuess, setLastVoiceGuess] = useState<string | null>(null)
  const guessCounter = useRef(0)

  const wsRef = useRef<WebSocket | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null)

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsPort = import.meta.env.VITE_WS_PORT as string | undefined
    const wsHost = wsPort ? `${window.location.hostname}:${wsPort}` : window.location.host
    const wsUrl = `${protocol}//${wsHost}/ws/room/${roomId}?token=${encodeURIComponent(token)}`
    wsRef.current = new WebSocket(wsUrl)

    wsRef.current.onopen = () => {
      setError('')
    }

    wsRef.current.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string)
        if (data.type === 'PLAYERS_UPDATE') {
          setPlayerCount(Array.isArray(data.players) ? data.players.length : 0)
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
          setIsThinking(!isWin && gameState === 'PLAYING')
        } else if (data.type === 'VOICE_TRANSCRIPT') {
          setVoiceTranscript(data.transcript as string)
        } else if (data.type === 'VOICE_GUESS_SUBMITTED') {
          setLastVoiceGuess(data.guess as string)
          setVoiceTranscript('')
        } else if (data.type === 'NEW_GAME_PREPARING') {
          setGameState('WAITING')
          setCurrentTranscript('')
          setGuessHistory([])
          setWinnerMessage(null)
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
          if (winnerType === 'gm_lost' || tabooViolation) {
            setWinnerMessage('GM lost — a taboo word was said.')
          } else if (winnerType === 'time_up') {
            setWinnerMessage("Time's up!")
          } else if (winnerType && winningGuess) {
            setWinnerMessage(
              `${winnerType === 'AI' ? 'AI' : winnerDisplayName || 'Player'} won with guess "${winningGuess}"`,
            )
          } else {
            setWinnerMessage('Game over.')
          }
          setGameState('FINISHED')
          setIsThinking(false)
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
        }
      } catch (e) {
        console.error('[WS ROOM PLAYER] Error parsing message:', e, 'raw:', event.data)
      }
    }

    wsRef.current.onerror = () => {
      setError('WebSocket connection failed. Ensure backend is running.')
    }

    wsRef.current.onclose = (e: CloseEvent) => {
      console.log('[WS ROOM PLAYER] Closed', e.code, e.reason, e.wasClean)
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect()
        scriptProcessorRef.current = null
      }
      if (mediaStreamRef.current) {
        for (const track of mediaStreamRef.current.getTracks()) track.stop()
        mediaStreamRef.current = null
      }
      if (audioContextRef.current) {
        void audioContextRef.current.close()
        audioContextRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [roomId, token, gameState])

  const handleSubmitGuess = (e: FormEvent) => {
    e.preventDefault()
    const guess = currentGuess.trim()
    if (!guess || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'GUESS_SUBMIT', guess }))
    setCurrentGuess('')
    setIsThinking(true)
  }

  const startRecording = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
      mediaStreamRef.current = stream

      const ctx = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = ctx

      const source = ctx.createMediaStreamSource(stream)
      const processor = ctx.createScriptProcessor(4096, 1, 1)
      scriptProcessorRef.current = processor

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
        const float32 = e.inputBuffer.getChannelData(0)
        const int16 = new Int16Array(float32.length)
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]))
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
        }
        wsRef.current.send(int16.buffer)
      }

      source.connect(processor)
      processor.connect(ctx.destination)

      setIsRecording(true)
      setVoiceTranscript('')
    } catch (err) {
      console.error('[MIC] Failed to start recording:', err)
      setError('Could not access microphone.')
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect()
      scriptProcessorRef.current = null
    }
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) track.stop()
      mediaStreamRef.current = null
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'PLAYER_AUDIO_STOP' }))
    }
    setIsRecording(false)
  }, [])

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
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-center">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-700/50 border border-slate-600 text-slate-300 text-sm">
          <Users className="w-4 h-4" />
          {playerCount} player{playerCount !== 1 ? 's' : ''} in room
        </span>
      </div>
      {error && (
        <div className="flex items-center gap-3 p-4 text-sm text-red-200 rounded-xl bg-red-900/30 border border-red-500/30">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {winnerMessage && (
        <div className="flex items-center gap-3 p-4 text-sm text-emerald-200 rounded-xl bg-emerald-900/30 border border-emerald-500/40">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          <span className="font-medium">{winnerMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 shadow-inner flex flex-col h-[300px]">
          <div className="flex items-center gap-2 mb-4 text-slate-400 text-sm font-bold uppercase tracking-widest border-b border-slate-800 pb-2">
            <Mic className="w-4 h-4" /> Live Transcript
          </div>
          <div className="flex-1 overflow-y-auto text-slate-300 font-medium leading-relaxed">
            {currentTranscript || (
              <span className="text-slate-600 italic">
                Waiting for the Game Master to start speaking and for the game to begin…
              </span>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-b from-indigo-950/60 to-slate-900/80 border border-indigo-500/30 rounded-2xl flex flex-col relative overflow-hidden h-[300px]">
          <div className="flex items-center justify-between px-5 py-3 border-b border-indigo-500/20 shrink-0">
            <div className="flex items-center gap-3">
              {isThinking && gameState === 'PLAYING' && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-900/30 border border-indigo-500/20">
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                  <span className="text-indigo-400/80 text-xs italic">Thinking…</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700">
              <Clock className={`w-4 h-4 ${timeLeft <= 5 ? 'text-red-400 animate-bounce' : 'text-slate-400'}`} />
              <span className={`font-mono text-lg font-bold ${timeLeft <= 5 ? 'text-red-400' : 'text-slate-200'}`}>
                0:{timeLeft.toString().padStart(2, '0')}
              </span>
            </div>
          </div>

          <div className="flex-1 flex min-h-0">
            <div className="flex-1 flex flex-col min-w-0 border-r border-indigo-500/20">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-indigo-500/10 shrink-0">
                <User className="w-4 h-4 text-amber-400" />
                <span className="text-amber-300/90 text-xs font-bold uppercase tracking-widest">
                  Human guesses
                  {humanGuesses.length > 0 && (
                    <span className="ml-1 font-normal normal-case text-amber-400/70">
                      ({humanGuesses.length})
                    </span>
                  )}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                {humanGuesses.length === 0 && (
                  <p className="text-slate-600 italic text-xs text-center py-4">Human guesses will appear here…</p>
                )}
                {humanGuesses.map((g, i) => (
                  <GuessRow
                    key={g.id}
                    g={g}
                    totalInFeed={humanGuesses.length}
                    indexInFeed={i}
                    isThinking={isThinking}
                  />
                ))}
              </div>
            </div>
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-indigo-500/10 shrink-0">
                <Brain className="w-4 h-4 text-indigo-400" />
                <span className="text-indigo-300/90 text-xs font-bold uppercase tracking-widest">
                  AI guesses
                  {aiGuesses.length > 0 && (
                    <span className="ml-1 font-normal normal-case text-indigo-400/70">
                      ({aiGuesses.length})
                    </span>
                  )}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                {aiGuesses.length === 0 && (
                  <p className="text-slate-600 italic text-xs text-center py-4">AI guesses will appear here…</p>
                )}
                {aiGuesses.map((g, i) => (
                  <GuessRow
                    key={g.id}
                    g={g}
                    totalInFeed={aiGuesses.length}
                    indexInFeed={i}
                    isThinking={isThinking}
                  />
                ))}
              </div>
            </div>
          </div>
          <style>{`
            @keyframes guessPopIn {
              from { opacity: 0; transform: translateY(-8px) scale(0.95); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
        </div>
      </div>

      <div className="w-full max-w-2xl space-y-3 mt-4">
        <form onSubmit={handleSubmitGuess} className="flex w-full items-center gap-3">
          <input
            type="text"
            value={currentGuess}
            onChange={(e) => setCurrentGuess(e.target.value)}
            placeholder="Type your guess..."
            className="flex-1 rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            disabled={gameState !== 'PLAYING'}
          />
          <button
            type="submit"
            disabled={gameState !== 'PLAYING' || !currentGuess.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
          <button
            type="button"
            disabled={gameState !== 'PLAYING'}
            onClick={() => { void (isRecording ? stopRecording() : startRecording()) }}
            title={isRecording ? 'Stop speaking' : 'Speak your guess'}
            className={`relative inline-flex items-center justify-center rounded-full p-2.5 text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60 ${
              isRecording
                ? 'bg-red-600 hover:bg-red-500 focus-visible:ring-red-500'
                : 'bg-slate-700 hover:bg-slate-600 focus-visible:ring-slate-500'
            }`}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {isRecording && (
              <span className="absolute inset-0 rounded-full animate-ping bg-red-500 opacity-40" />
            )}
          </button>
        </form>

        {(isRecording || voiceTranscript) && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-900/20 px-4 py-2.5 text-sm">
            <span className="mt-0.5 flex h-2 w-2 shrink-0 rounded-full bg-red-400 animate-pulse" />
            <span className="text-red-200">
              {voiceTranscript || <span className="italic text-red-300/60">Listening…</span>}
            </span>
          </div>
        )}

        {lastVoiceGuess && !isRecording && (
          <div className="flex items-center gap-2 rounded-xl border border-slate-600/40 bg-slate-800/40 px-4 py-2 text-sm text-slate-400">
            <Mic className="w-3.5 h-3.5 shrink-0 text-slate-500" />
            <span>Last spoken guess: </span>
            <span className="font-semibold text-slate-200">{lastVoiceGuess}</span>
          </div>
        )}
      </div>
    </div>
  )
}

