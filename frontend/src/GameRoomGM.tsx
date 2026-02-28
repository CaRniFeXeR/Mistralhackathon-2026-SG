import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Brain, CheckCircle2, Clock, ChevronDown, Mic, Play, Square, User, Users } from 'lucide-react'

export interface GameRoomGMProps {
  roomId: string
  targetWord: string
  tabooWords?: string[]
  token: string
}

type GameState = 'PREPARING' | 'PLAYING' | 'FINISHED'

interface GuessEntry {
  id: number
  text: string
  isWin: boolean
  source: 'AI' | 'human'
  userName: string
}

const MODE_PROMPT =
  'You are playing Taboo. The player is describing a secret word without saying it or the taboo words. Guess the word based only on their description. Answer with ONLY the single word, nothing else.'

export default function GameRoomGM({ roomId, targetWord, tabooWords, token }: GameRoomGMProps) {
  const [gameState, setGameState] = useState<GameState>('PREPARING')
  const [timeLeft, setTimeLeft] = useState(60)
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [guessHistory, setGuessHistory] = useState<GuessEntry[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [error, setError] = useState('')
  const [winnerMessage, setWinnerMessage] = useState<string | null>(null)
  const [humanPlayers, setHumanPlayers] = useState<{ name: string }[]>([])
  const [playersPopoverOpen, setPlayersPopoverOpen] = useState(false)
  const guessCounter = useRef(0)

  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const gameStateRef = useRef<GameState>('PREPARING')
  const guessHistoryRef = useRef<GuessEntry[]>([])

  useEffect(() => {
    return () => {
      cleanupAudioAndConnection()
    }
  }, [])

  const cleanupAudioAndConnection = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    gameStateRef.current = 'PREPARING'
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error)
      }
      audioContextRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }

  const startGame = async () => {
    setError('')
    setWinnerMessage(null)
    guessCounter.current = 0
    guessHistoryRef.current = []
    setGuessHistory([])
    setGameState('PLAYING')
    gameStateRef.current = 'PLAYING'
    setTimeLeft(60)
    setCurrentTranscript('')

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsPort = import.meta.env.VITE_WS_PORT as string | undefined
      const wsHost = wsPort ? `${window.location.hostname}:${wsPort}` : window.location.host
      const wsUrl = `${protocol}//${wsHost}/ws/room/${roomId}?token=${encodeURIComponent(token)}`
      wsRef.current = new WebSocket(wsUrl)

      wsRef.current.onopen = () => {
        const config: { prompt: string; target_word?: string; taboo_words?: string[] } = {
          prompt: MODE_PROMPT,
          target_word: targetWord,
          taboo_words: tabooWords ?? [],
        }
        wsRef.current?.send(JSON.stringify(config))
        setIsThinking(true)
      }

      wsRef.current.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data as string)
          if (data.type === 'PLAYERS_UPDATE') {
            setHumanPlayers(Array.isArray(data.players) ? data.players : [])
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
          } else if (data.type === 'GAME_OVER') {
            const winnerType = data.winnerType as string | undefined
            const tabooViolation = Boolean(data.tabooViolation)
            const winnerDisplayName = (data.winnerDisplayName as string | undefined) ?? ''
            const winningGuess = (data.winningGuess as string | undefined) ?? ''
            if (winnerType === 'gm_lost' || tabooViolation) {
              setWinnerMessage('GM lost — a taboo word was said.')
            } else if (winnerType && winningGuess) {
              setWinnerMessage(
                `${winnerType === 'AI' ? 'AI' : winnerDisplayName || 'Player'} won with guess "${winningGuess}"`,
              )
            } else {
              setWinnerMessage('Game over.')
            }
            setGameState('FINISHED')
            gameStateRef.current = 'FINISHED'
            setIsThinking(false)
            cleanupAudioAndConnection()
          }
        } catch (e) {
          console.error('[WS ROOM GM] Error parsing message:', e, 'raw:', event.data)
        }
      }

      wsRef.current.onerror = () => {
        setError('WebSocket connection failed. Ensure backend is running.')
      }

      wsRef.current.onclose = (e: CloseEvent) => {
        console.log('[WS ROOM GM] Closed', e.code, e.reason, e.wasClean)
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      streamRef.current = stream

      const audioContext = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
        sampleRate: 16000,
      })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
        if (gameStateRef.current !== 'PLAYING') return
        const inputData = e.inputBuffer.getChannelData(0)
        const pcm16 = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]))
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
        }
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(pcm16.buffer)
        }
      }

      source.connect(processor)
      processor.connect(audioContext.destination)

      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err) {
      console.error('Setup error:', err)
      setError('Microphone access denied or audio issue.')
      cleanupAudioAndConnection()
      setGameState('PREPARING')
      gameStateRef.current = 'PREPARING'
    }
  }

  const handleStop = () => {
    cleanupAudioAndConnection()
    setGameState('PREPARING')
    gameStateRef.current = 'PREPARING'
  }

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
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all ${
          g.isWin
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
          className={`font-bold tracking-wide text-base leading-tight flex-1 ${
            g.isWin ? 'text-emerald-300' : isLatest ? 'text-indigo-100' : 'text-slate-400'
          }`}
        >
          {g.text}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            g.source === 'AI'
              ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/40'
              : 'bg-amber-500/20 text-amber-200 border border-amber-400/40'
          }`}
        >
          {g.source === 'AI' ? (
            <>
              <Brain className="w-3 h-3" />
              AI
            </>
          ) : (
            <>
              <User className="w-3 h-3" />
              {g.userName || 'Player'}
            </>
          )}
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
      <div className="bg-slate-800/60 border border-slate-700 rounded-3xl p-6 shadow-xl text-center">
        <h2 className="text-3xl font-black text-white mb-2 tracking-tight">
          Target Word: <span className="text-indigo-400">&quot;{targetWord}&quot;</span>
        </h2>
        {gameState !== 'PREPARING' && (
          <div className="relative inline-block mt-3">
            <button
              type="button"
              onClick={() => setPlayersPopoverOpen((open) => !open)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200 hover:bg-amber-500/30 transition-colors"
            >
              <Users className="w-4 h-4" />
              <span className="font-semibold">
                {humanPlayers.length} human player{humanPlayers.length !== 1 ? 's' : ''} joined
              </span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${playersPopoverOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {playersPopoverOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  aria-hidden
                  onClick={() => setPlayersPopoverOpen(false)}
                />
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 min-w-[180px] py-2 rounded-xl bg-slate-800 border border-slate-600 shadow-xl">
                  {humanPlayers.length === 0 ? (
                    <p className="px-4 py-2 text-slate-500 text-sm">No players in room</p>
                  ) : (
                    <ul className="text-left">
                      {humanPlayers.map((p, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-2 px-4 py-2 text-amber-200 hover:bg-slate-700/50"
                        >
                          <User className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          {p.name || 'Player'}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        {tabooWords && tabooWords.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-bold text-red-400 uppercase tracking-widest mb-2">Taboo Words (Do Not Say):</p>
            <div className="flex flex-wrap justify-center gap-2">
              {tabooWords.map((word, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-200 rounded-lg text-sm font-medium line-through decoration-red-500/50"
                >
                  {word}
                </span>
              ))}
            </div>
          </div>
        )}
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
            {currentTranscript || <span className="text-slate-600 italic">Start speaking...</span>}
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

      <div className="flex justify-center mt-8">
        {gameState === 'PREPARING' && (
          <button
            type="button"
            onClick={startGame}
            className="flex items-center gap-3 px-10 py-5 rounded-full font-bold text-xl text-white shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-all hover:scale-105 hover:bg-indigo-500 bg-indigo-600 border border-indigo-400/30"
          >
            <Play className="w-6 h-6 fill-current" /> Start Challenge
          </button>
        )}
        {gameState === 'PLAYING' && (
          <button
            type="button"
            onClick={handleStop}
            className="flex items-center gap-3 px-8 py-4 rounded-full font-bold text-lg text-white transition-all hover:scale-105 bg-red-600 hover:bg-red-500 border border-red-400/30"
          >
            <Square className="w-5 h-5 fill-current" /> Give Up
          </button>
        )}
        {gameState === 'FINISHED' && (
          <div className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-8 py-4 rounded-full font-bold text-xl flex items-center gap-3 shadow-[0_0_40px_rgba(16,185,129,0.3)]">
            <CheckCircle2 className="w-7 h-7" /> Game Finished
          </div>
        )}
      </div>
    </div>
  )
}

