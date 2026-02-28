import { useState, useEffect, useRef } from 'react'
import { Mic, Play, Square, AlertCircle, CheckCircle2, Clock, Brain } from 'lucide-react'
import { buildGameWsUrl } from './ws'
import { useWebSocket } from './hooks/useWebSocket'
import { useAudioStream } from './hooks/useAudioStream'
import type { GameInboundMessage } from './types/ws'

export interface GameRoomProps {
  targetWord: string
  tabooWords?: string[]
  modePrompt: string
  onWin: (timeLeft: number, transcript: string, winningGuess: string) => void
  onEnd: (message: string, transcript: string) => void
}

type GameState = 'PREPARING' | 'PLAYING' | 'WON' | 'LOST'

interface GuessEntry {
  id: number
  text: string
  isWin: boolean
}

export default function GameRoom({ targetWord, tabooWords, modePrompt, onWin, onEnd }: GameRoomProps) {
  const [gameState, setGameState] = useState<GameState>('PREPARING')
  const [timeLeft, setTimeLeft] = useState(60)
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [guessHistory, setGuessHistory] = useState<GuessEntry[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [error, setError] = useState('')
  const guessCounter = useRef(0)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const gameStateRef = useRef<GameState>('PREPARING')
  const guessHistoryRef = useRef<GuessEntry[]>([])
  const guessListRef = useRef<HTMLDivElement | null>(null)
  const transcriptRef = useRef('')

  useEffect(() => {
    if (gameState === 'PLAYING') {
      setIsThinking(true)
    } else {
      setIsThinking(false)
    }
  }, [gameState])

  const [shouldConnectWs, setShouldConnectWs] = useState(false)

  const handleWsMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data as string) as GameInboundMessage
      if (data.type === 'TRANSCRIPT_UPDATE') {
        const t = data.transcript as string
        transcriptRef.current = t
        setCurrentTranscript(t)
      } else if (data.type === 'GAME_OVER' && data.tabooViolation) {
        setGameState('LOST')
        cleanupAudioAndConnection()
        setTimeout(() => {
          onEnd('You said a taboo word — game over.', transcriptRef.current)
        }, 2000)
      } else if (data.type === 'AI_GUESS') {
        const guessText = data.guess as string
        const id = ++guessCounter.current
        const isWin = gameStateRef.current === 'PLAYING' && checkWin(guessText)
        const entry: GuessEntry = { id, text: guessText, isWin }
        guessHistoryRef.current = [entry, ...guessHistoryRef.current]
        setGuessHistory([...guessHistoryRef.current])
        setIsThinking(false)
        if (isWin) {
          setTimeout(() => setIsThinking(false), 0)
          handleWin(guessText)
        } else {
          setTimeout(() => {
            if (gameStateRef.current === 'PLAYING') setIsThinking(true)
          }, 800)
        }
      }
    } catch (e) {
      console.error('[WS] Error parsing message:', e, 'raw:', event.data)
    }
  }

  const { sendJson, sendBinary, close, readyState } = useWebSocket(
    shouldConnectWs ? buildGameWsUrl() : null,
    {
      onOpen: () => {
        const config: { prompt: string; target_word?: string; taboo_words?: string[] } = {
          prompt: modePrompt,
          target_word: targetWord,
          taboo_words: tabooWords ?? [],
        }
        sendJson(config)
      },
      onMessage: handleWsMessage,
      onError: () => {
        setError('WebSocket connection failed. Ensure backend is running.')
      },
      onClose: (e: CloseEvent) => {
        console.log('[WS] Closed', e.code, e.reason, e.wasClean)
      },
    },
  )

  const {
    start: startAudio,
    stop: stopAudio,
    error: audioError,
  } = useAudioStream({
    onAudioFrame: (pcm16) => {
      if (gameStateRef.current !== 'PLAYING') return
      if (readyState !== WebSocket.OPEN) return
      sendBinary(pcm16)
    },
  })

  const cleanupAudioAndConnection = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    gameStateRef.current = 'PREPARING'
    stopAudio()
  }

  useEffect(() => {
    if (audioError) {
      setError(audioError)
    }
  }, [audioError])

  useEffect(() => {
    return () => {
      cleanupAudioAndConnection()
      close()
    }
  }, [close])

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, '').trim()

  const checkWin = (guessText: string): boolean => {
    if (!targetWord) return false
    const cleanGuess = normalize(guessText)
    const cleanTarget = normalize(targetWord)
    const exactMatch = cleanGuess === cleanTarget
    const escapedTarget = cleanTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const wordBoundaryMatch = new RegExp(`\\b${escapedTarget}\\b`).test(cleanGuess)
    return exactMatch || wordBoundaryMatch
  }

  const handleWin = (winningGuessText: string) => {
    setGameState('WON')
    cleanupAudioAndConnection()
    setTimeout(() => {
      onWin(timeLeft, currentTranscript, winningGuessText)
    }, 2000)
  }

  const handleLoss = () => {
    setGameState('LOST')
    cleanupAudioAndConnection()
    setTimeout(() => {
      onEnd("Time's up! The AI couldn't guess the word.", currentTranscript)
    }, 2000)
  }

  const startPlaying = async () => {
    setError('')
    guessCounter.current = 0
    guessHistoryRef.current = []
    setGuessHistory([])
    setGameState('PLAYING')
    gameStateRef.current = 'PLAYING'
    setTimeLeft(60)
    setCurrentTranscript('')

    try {
      setShouldConnectWs(true)

      await startAudio()

      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleLoss()
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
    }
  }

  const handleStop = () => {
    cleanupAudioAndConnection()
    setGameState('PREPARING')
    onEnd('You stopped the game.', currentTranscript)
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="bg-slate-800/60 border border-slate-700 rounded-3xl p-6 shadow-xl text-center">
        <h2 className="text-3xl font-black text-white mb-2 tracking-tight">
          Target Word: <span className="text-indigo-400">&quot;{targetWord}&quot;</span>
        </h2>
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
            <div className="flex items-center gap-2 text-indigo-300 text-sm font-bold uppercase tracking-widest">
              <Brain className="w-4 h-4" />
              AI Guesses
              {guessHistory.length > 0 && (
                <span className="ml-1 text-indigo-400/60 font-normal normal-case tracking-normal">
                  ({guessHistory.length})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700">
              <Clock className={`w-4 h-4 ${timeLeft <= 5 ? 'text-red-400 animate-bounce' : 'text-slate-400'}`} />
              <span className={`font-mono text-lg font-bold ${timeLeft <= 5 ? 'text-red-400' : 'text-slate-200'}`}>
                0:{timeLeft.toString().padStart(2, '0')}
              </span>
            </div>
          </div>

          <div ref={guessListRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {isThinking && gameState === 'PLAYING' && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-900/30 border border-indigo-500/20">
                <div className="flex gap-1 items-center">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-indigo-400/70 text-sm italic">Thinking…</span>
              </div>
            )}

            {guessHistory.length === 0 && !isThinking && (
              <p className="text-slate-600 italic text-sm text-center mt-8">Guesses will appear here…</p>
            )}
            {guessHistory.map((g, i) => (
              <div
                key={g.id}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all ${
                  g.isWin
                    ? 'bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                    : i === 0 && !isThinking
                      ? 'bg-indigo-900/50 border-indigo-400/40'
                      : 'bg-slate-800/40 border-slate-700/40'
                } ${i === 0 ? 'guess-pop-in' : ''}`}
              >
                {g.isWin ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <span className="text-slate-500 text-xs font-mono w-4 text-right shrink-0">
                    {guessHistory.length - i}
                  </span>
                )}
                <span
                  className={`font-bold tracking-wide text-base leading-tight ${
                    g.isWin ? 'text-emerald-300' : i === 0 && !isThinking ? 'text-indigo-100' : 'text-slate-400'
                  }`}
                >
                  {g.text}
                </span>
                {g.isWin && (
                  <span className="ml-auto text-xs text-emerald-400 font-semibold uppercase tracking-widest">
                    ✓ Got it!
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-center mt-8">
        {gameState === 'PREPARING' && (
          <button
            type="button"
            onClick={startPlaying}
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
        {gameState === 'WON' && (
          <div className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-8 py-4 rounded-full font-bold text-xl flex items-center gap-3 animate-bounce shadow-[0_0_40px_rgba(16,185,129,0.3)]">
            <CheckCircle2 className="w-7 h-7" /> Target Reached!
          </div>
        )}
        {gameState === 'LOST' && (
          <div className="bg-red-500/20 text-red-300 border border-red-500/30 px-8 py-4 rounded-full font-bold text-xl">
            Time Is Up!
          </div>
        )}
      </div>
    </div>
  )
}
