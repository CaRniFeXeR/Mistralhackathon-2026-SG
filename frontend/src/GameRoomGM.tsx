import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Brain, CheckCircle2, Clock, ChevronDown, Mic, User, Users } from 'lucide-react'
import { buildRoomWsUrl } from './ws'
import { useWebSocket } from './hooks/useWebSocket'
import { useAudioStream } from './hooks/useAudioStream'
import type { RoomInboundMessage } from './types/ws'
import GameOverScreen from './GameOverScreen'

export interface GameRoomGMProps {
  roomId: string
  targetWord: string
  tabooWords?: string[]
  token: string
  onStateChange?: (state: GameState) => void
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

export default function GameRoomGM({ roomId, targetWord, tabooWords, token, onStateChange }: GameRoomGMProps) {
  const navigate = useNavigate()
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
  const [gameOverData, setGameOverData] = useState<{
    isWin: boolean
    targetWord: string
    reasonTitle: string
    reasonMessage: string
  } | null>(null)
  const [humanPlayers, setHumanPlayers] = useState<{ name: string }[]>([])
  const [playersPopoverOpen, setPlayersPopoverOpen] = useState(false)
  const guessCounter = useRef(0)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const gameStateRef = useRef<GameState>('PREPARING')
  const guessHistoryRef = useRef<GuessEntry[]>([])

  const cleanupAudioOnly = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const cleanupAudioAndConnection = () => {
    cleanupAudioOnly()
    gameStateRef.current = 'PREPARING'
  }

  const roomWsUrl = buildRoomWsUrl(roomId, token)

  const handleWsMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data as string) as RoomInboundMessage
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
        gameStateRef.current = 'FINISHED'
        setIsThinking(false)
        cleanupAudioOnly()
      }
    } catch (e) {
      console.error('[WS ROOM GM] Error parsing message:', e, 'raw:', event.data)
    }
  }, [])

  const { sendJson, sendBinary, close, readyState } = useWebSocket(roomWsUrl, {
    onError: () => {
      setError('WebSocket connection failed. Ensure backend is running.')
    },
    onMessage: handleWsMessage,
    onClose: (e: CloseEvent) => {
      console.log('[WS ROOM GM] Closed', e.code, e.reason, e.wasClean)
    },
  })

  const {
    start: startAudio,
    stop: stopAudio,
    error: audioError,
  } = useAudioStream({
    onAudioFrame: (pcm16) => {
      if (readyState !== WebSocket.OPEN) return
      if (gameStateRef.current !== 'PLAYING') return
      sendBinary(pcm16)
    },
  })

  useEffect(() => {
    if (audioError) {
      setError(audioError)
    }
  }, [audioError])

  useEffect(() => {
    onStateChange?.(gameState)
  }, [gameState, onStateChange])

  useEffect(() => {
    return () => {
      cleanupAudioAndConnection()
      close()
    }
  }, [close])

  const startGame = async () => {
    setError('')
    setGameOverData(null)
    guessCounter.current = 0
    guessHistoryRef.current = []
    setGuessHistory([])
    setGameState('PLAYING')
    gameStateRef.current = 'PLAYING'
    setTimeLeft(60)
    setCurrentTranscript('')

    try {
      if (readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket is not connected')
      }

      const config: { type: string; prompt: string } = {
        type: 'START_GAME',
        prompt: MODE_PROMPT,
      }
      sendJson(config)
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
  }

  const handleStop = () => {
    cleanupAudioOnly()
    stopAudio()
    setGameState('PREPARING')
    gameStateRef.current = 'PREPARING'
  }

  const startNewGame = () => {
    if (readyState !== WebSocket.OPEN) return
    const tabooArray = newTabooWordsStr.split(',').map((s) => s.trim()).filter(Boolean)
    sendJson({
      type: 'NEW_GAME',
      target_word: newTargetWord,
      taboo_words: tabooArray,
    })
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
          className={`font-bold tracking-wide text-base leading-tight flex-1 ${g.isWin ? 'text-emerald-300' : isLatest ? 'text-indigo-100' : 'text-slate-400'
            }`}
        >
          {g.text}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold ${g.source === 'AI'
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
    <div className="w-full space-y-6">
      {gameState === 'FINISHED' && gameOverData && (
        <GameOverScreen
          isVictory={gameOverData.isWin}
          targetWord={gameOverData.targetWord}
          reasonTitle={gameOverData.reasonTitle}
          reasonMessage={gameOverData.reasonMessage}
        >
          <section className="ascii-border border-double p-6 w-full max-w-lg mt-6 bg-black/80 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4 text-center">++ SEQUENCE_COMPLETE</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-blue-400 mb-1">[ NEW_TARGET ]</label>
                <input
                  type="text"
                  value={newTargetWord}
                  onChange={(e) => setNewTargetWord(e.target.value)}
                  className="terminal-input w-full"
                />
              </div>
              <div>
                <label className="block text-sm text-blue-400 mb-1">[ NEW_RESTRICTIONS (csv) ]</label>
                <input
                  type="text"
                  value={newTabooWordsStr}
                  onChange={(e) => setNewTabooWordsStr(e.target.value)}
                  className="terminal-input w-full"
                />
              </div>
              <button
                type="button"
                onClick={startNewGame}
                className="ascii-btn w-full mt-4"
              >
                &lt; RESTART_SEQUENCE /&gt;
              </button>
              <button
                type="button"
                onClick={() => navigate(`/room/${roomId}/history`)}
                className="ascii-btn w-full mt-3"
              >
                &lt; VIEW_SEQUENCE_LOG /&gt;
              </button>
            </div>
          </section>
        </GameOverScreen>
      )}

      {gameState !== 'FINISHED' && (
        <>
          <section className="ascii-border border-double p-4 mb-6 relative text-center mt-6">
            <div className="absolute -top-3 left-4 bg-black px-2 text-red-500 text-sm font-bold tracking-widest">[ TARGET_ACQUISITION ]</div>

            <div className="relative inline-block mt-2 mb-4">
              <button
                type="button"
                onClick={() => setPlayersPopoverOpen((open) => !open)}
                className="inline-flex items-center gap-2 px-3 py-1 font-bold text-blue-400 border border-blue-500/50 bg-blue-900/20 hover:bg-blue-800/30 transition-colors"
              >
                <Users className="w-4 h-4" />
                <span>PLAYERS: {humanPlayers.length}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${playersPopoverOpen ? 'rotate-180' : ''}`} />
              </button>
              {playersPopoverOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    aria-hidden
                    onClick={() => setPlayersPopoverOpen(false)}
                  />
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 min-w-[180px] py-2 bg-black border border-blue-500 shadow-xl">
                    {humanPlayers.length === 0 ? (
                      <p className="px-4 py-2 text-slate-500 text-sm">NO PLAYERS</p>
                    ) : (
                      <ul className="text-left text-blue-300">
                        {humanPlayers.map((p, i) => (
                          <li key={i} className="flex items-center gap-2 px-4 py-1 hover:bg-blue-900/30 font-mono">
                            <User className="w-3 h-3 text-blue-500" />
                            {p.name || 'UNKNOWN'}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>

            <h2 className="text-4xl font-black text-white mb-2 tracking-widest break-all uppercase">
              {localTargetWord}
            </h2>

            {localTabooWords && localTabooWords.length > 0 && (
              <div className="mt-4 border-t border-dashed border-gray-800 pt-4">
                <p className="text-sm font-bold text-red-500 mb-2">[ RESTRICTED_TERMS ]</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {localTabooWords.map((word, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-red-900/30 text-red-400 text-xs border border-red-500/50 line-through uppercase"
                    >
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {error && (
            <div className="mb-4 border border-red-500 p-3 bg-red-900/20 text-red-400 font-bold flex gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>ERR: {error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
            <div className="ascii-border border-double p-4 relative flex flex-col h-[300px]">
              <div className="absolute -top-3 left-4 bg-black px-2 text-blue-500 text-sm font-bold tracking-widest">[ VOICE_INTERCEPT ]</div>
              <div className="mt-2 flex-1 flex flex-col min-h-0">
                <div className="flex items-center gap-2 mb-2 text-slate-500 text-xs border-b border-gray-800 pb-2">
                  <Mic className="w-3 h-3 text-red-500 animate-pulse" /> LIVE_AUDIO_FEED
                </div>
                <div className="flex-1 overflow-y-auto font-mono text-sm text-green-400 leading-relaxed uppercase pr-2">
                  {currentTranscript || <span className="text-slate-600 opacity-50">&gt; AWAITING INPUT...</span>}
                </div>
              </div>
            </div>

            <div className="ascii-border border-double p-4 relative flex flex-col h-[300px]">
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
                  <Clock className="w-4 h-4" />
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

          <div className="flex justify-center mt-8 pb-8">
            {gameState === 'PREPARING' && (
              <button
                type="button"
                onClick={startGame}
                className="ascii-btn w-full max-w-sm"
              >
                &lt; EXECUTE_SESSION /&gt;
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
        </>
      )}
    </div>
  )
}

