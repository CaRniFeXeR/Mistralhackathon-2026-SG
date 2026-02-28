import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Brain, CheckCircle2, Clock, ChevronDown, Mic, Share2, User, Users } from 'lucide-react'
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
  const [shareFeedback, setShareFeedback] = useState<'copied' | null>(null)
  const guessCounter = useRef(0)

  const roomLink = `${window.location.origin}${window.location.pathname}#/room/${roomId}`

  const handleShare = useCallback(async () => {
    const shareData = {
      title: 'Taboo Game Room',
      text: 'Join this Taboo game room',
      url: roomLink,
    }
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          try {
            await navigator.clipboard.writeText(roomLink)
            setShareFeedback('copied')
            setTimeout(() => setShareFeedback(null), 2000)
          } catch {
            setError('Could not share or copy link.')
          }
        }
      }
      return
    }
    try {
      await navigator.clipboard.writeText(roomLink)
      setShareFeedback('copied')
      setTimeout(() => setShareFeedback(null), 2000)
    } catch {
      setError('Could not copy link.')
    }
  }, [roomLink])

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const gameStateRef = useRef<GameState>('PREPARING')
  const guessHistoryRef = useRef<GuessEntry[]>([])
  const prevPlayerCountRef = useRef<number | null>(null)

  const playJoinSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
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
  }, [playJoinSound])

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
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${g.isWin
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
          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
        ) : (
          <span className="text-slate-500 text-sm font-mono w-5 text-right shrink-0">
            {totalInFeed - indexInFeed}
          </span>
        )}
        <span
          className={`font-bold tracking-wide text-2xl leading-tight flex-1 ${g.isWin ? 'text-emerald-300' : isLatest ? 'text-indigo-100' : 'text-slate-400'
            }`}
        >
          {g.text}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 shrink-0 px-3 py-1 rounded-full text-base font-semibold ${g.source === 'AI'
            ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/40'
            : 'bg-amber-500/20 text-amber-200 border border-amber-400/40'
            }`}
        >
          {g.source === 'AI' ? (
            <>
              <Brain className="w-4 h-4" />
              AI
            </>
          ) : (
            <>
              <User className="w-4 h-4" />
              {g.userName || 'Player'}
            </>
          )}
        </span>
        {g.isWin && (
          <span className="ml-auto text-base text-emerald-400 font-semibold uppercase tracking-widest">
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
          <section className="ascii-border border-double p-6 mb-6 relative text-center mt-6">
            <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
              <div className="relative inline-block">
                <button
                  type="button"
                  onClick={() => setPlayersPopoverOpen((open) => !open)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-lg font-bold text-blue-400 border border-blue-500/50 bg-blue-900/20 hover:bg-blue-800/30 transition-colors"
                >
                  <Users className="w-5 h-5" />
                  <span>PLAYERS: {humanPlayers.length}</span>
                  <ChevronDown className={`w-5 h-5 transition-transform ${playersPopoverOpen ? 'rotate-180' : ''}`} />
                </button>
              {playersPopoverOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    aria-hidden
                    onClick={() => setPlayersPopoverOpen(false)}
                  />
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 min-w-[220px] py-2 bg-black border border-blue-500 shadow-xl">
                    {humanPlayers.length === 0 ? (
                      <p className="px-4 py-2 text-slate-500 text-xl">No players yet</p>
                    ) : (
                      <ul className="text-left text-blue-300">
                        {humanPlayers.map((p, i) => (
                          <li key={i} className="flex items-center gap-2 px-4 py-2 hover:bg-blue-900/30 font-mono text-xl">
                            <User className="w-5 h-5 text-blue-500" />
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
                className="inline-flex items-center gap-2 px-4 py-2 text-lg font-bold text-emerald-400 border border-emerald-500/50 bg-emerald-900/20 hover:bg-emerald-800/30 transition-colors"
                title="Share room link"
              >
                <Share2 className="w-5 h-5" />
                <span>{shareFeedback === 'copied' ? 'LINK COPIED' : 'SHARE LINK'}</span>
              </button>
            </div>

            <p className="text-2xl font-semibold text-slate-300 mb-2">
              Please describe the word
            </p>
            <h2 className="text-6xl font-black text-white mb-3 tracking-widest break-all uppercase">
              {localTargetWord}
            </h2>
            <p className="text-2xl font-semibold text-slate-300 mb-4">
              without mentioning it.
            </p>

            {localTabooWords && localTabooWords.length > 0 && (
              <div className="mt-4 border-t border-dashed border-gray-800 pt-4">
                <p className="text-2xl font-bold text-slate-300 mb-3">The forbidden words are:</p>
                <div className="flex flex-wrap justify-center gap-3">
                  {localTabooWords.map((word, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 bg-red-900/30 text-red-400 text-2xl font-bold border border-red-500/50 uppercase"
                    >
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {error && (
            <div className="mb-4 border border-red-500 p-4 bg-red-900/20 text-red-400 font-bold flex gap-3 text-xl">
              <AlertCircle className="w-7 h-7 flex-shrink-0" />
              <span>Error: {error}</span>
            </div>
          )}

          <div className="flex justify-center mb-4">
            {gameState === 'PREPARING' && (
              <button
                type="button"
                onClick={startGame}
                className="ascii-btn w-full max-w-sm"
              >
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
            <div className="ascii-border border-double p-4 relative flex flex-col h-[180px]">
              <div className="absolute -top-3 left-4 bg-black px-2 text-blue-500 text-lg font-bold tracking-widest">[ VOICE ]</div>
              <div className="mt-2 flex-1 flex flex-col min-h-0">
                <div className="flex items-center gap-2 mb-2 text-slate-500 text-base border-b border-gray-800 pb-2">
                  <Mic className="w-4 h-4 text-red-500 animate-pulse" /> Live transcript
                </div>
                <div className="flex-1 overflow-y-auto font-mono text-base text-green-400 leading-relaxed uppercase pr-2">
                  {currentTranscript || <span className="text-slate-600 opacity-50">&gt; Awaiting speech...</span>}
                </div>
              </div>
            </div>

            <div className="ascii-border border-double p-4 relative flex flex-col h-[180px]">
              <div className="absolute -top-3 left-4 bg-black px-2 text-blue-500 text-lg font-bold tracking-widest">[ GUESSES ]</div>

              <div className="mt-2 flex items-center justify-between border-b border-gray-800 pb-2 mb-2 shrink-0">
                <div className="flex items-center gap-2">
                  {isThinking && gameState === 'PLAYING' && (
                    <span className="text-indigo-400 text-base animate-pulse font-bold tracking-widest">
                      AI thinking...
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-blue-400 text-2xl font-bold">
                  <Clock className="w-6 h-6" />
                  <span className={timeLeft <= 5 ? 'text-red-500 animate-pulse' : ''}>
                    {timeLeft.toString().padStart(2, '0')}s
                  </span>
                </div>
              </div>

              <div className="flex-1 flex min-h-0">
                <div className="flex-1 flex flex-col min-w-0 border-r border-gray-800 pr-2 mr-2">
                  <div className="text-amber-500 text-base font-bold tracking-widest mb-2 shrink-0 border-b border-gray-800 pb-1">
                    👤 Humans [{humanGuesses.length}]
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                    {humanGuesses.length === 0 && (
                      <p className="text-slate-700 text-base py-2">No guesses yet</p>
                    )}
                    {humanGuesses.map((g, i) => (
                      <GuessRow key={g.id} g={g} totalInFeed={humanGuesses.length} indexInFeed={i} isThinking={isThinking} />
                    ))}
                  </div>
                </div>
                <div className="flex-1 flex flex-col min-w-0">
                  <div className="text-indigo-400 text-base font-bold tracking-widest mb-2 shrink-0 border-b border-gray-800 pb-1">
                    🤖 AI [{aiGuesses.length}]
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                    {aiGuesses.length === 0 && (
                      <p className="text-slate-700 text-base py-2">No guesses yet</p>
                    )}
                    {aiGuesses.map((g, i) => (
                      <GuessRow key={g.id} g={g} totalInFeed={aiGuesses.length} indexInFeed={i} isThinking={isThinking} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

