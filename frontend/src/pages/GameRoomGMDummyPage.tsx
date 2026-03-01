import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ChevronDown, Clock, Share2, User, Users } from 'lucide-react'
import GameOverScreen from '../GameOverScreen'
import type { GameState, GuessEntry, GameOverData } from '../gameRoomGM/types'
import GMGameOverActions from '../gameRoomGM/GMGameOverActions'
import GMPlayingHeader from '../gameRoomGM/GMPlayingHeader'
import GMVoicePanel from '../gameRoomGM/GMVoicePanel'
import GMGuessesPanel from '../gameRoomGM/GMGuessesPanel'
import GMDesktopTargetBlock from '../gameRoomGM/GMDesktopTargetBlock'
import GMPlayersWithGuesses from '../gameRoomGM/GMPlayersWithGuesses'
import LabeledPanel from '../components/LabeledPanel'
import GuessFeedColumn from '../gameRoomGM/GuessFeedColumn'
import { ASCII_PANEL_CLASS } from '../gameRoomGM/utils'

const STAGES: GameState[] = ['PREPARING', 'PLAYING', 'FINISHED']

const MOCK_TARGET = 'Elephant'
const MOCK_TABOO = ['trunk', 'ivory', 'tusk']
const MOCK_PLAYERS = [{ name: 'Alice' }, { name: 'Bob' }]
const MOCK_TRANSCRIPT = "It's a large gray animal with a long nose."
const MOCK_GUESSES: GuessEntry[] = [
  { id: 1, text: 'Elephant', isWin: true, source: 'human', userName: 'Alice' },
  { id: 2, text: 'Big animal', isWin: false, source: 'AI', userName: 'AI' },
  { id: 3, text: 'Mammal', isWin: false, source: 'human', userName: 'Bob' },
]
const MOCK_GAME_OVER_VICTORY: GameOverData = {
  isWin: true,
  targetWord: 'Elephant',
  reasonTitle: 'Target acquired',
  reasonMessage: 'A human guessed the word in time.',
}
const MOCK_GAME_OVER_DEFEAT: GameOverData = {
  isWin: false,
  targetWord: 'Elephant',
  reasonTitle: 'Time up',
  reasonMessage: 'No one guessed the word.',
}
const DUMMY_ROOM_ID = 'dummy-room'

export default function GameRoomGMDummyPage() {
  const [stage, setStage] = useState<GameState>('PLAYING')
  const [gameOverVariant, setGameOverVariant] = useState<'victory' | 'defeat'>('victory')
  const [localTargetWord] = useState(MOCK_TARGET)
  const [localTabooWords] = useState(MOCK_TABOO)
  const [newTargetWord, setNewTargetWord] = useState(MOCK_TARGET)
  const [newTabooWordsStr, setNewTabooWordsStr] = useState(MOCK_TABOO.join(', '))
  const [humanPlayers] = useState(MOCK_PLAYERS)
  const [playersPopoverOpen, setPlayersPopoverOpen] = useState(false)
  const [shareFeedback, setShareFeedback] = useState<'copied' | null>(null)
  const [error, setError] = useState('')
  const [timeLeft] = useState(45)
  const [currentTranscript] = useState(MOCK_TRANSCRIPT)
  const [guessHistory] = useState<GuessEntry[]>(MOCK_GUESSES)
  const [isThinking] = useState(true)

  const humanGuesses = guessHistory.filter((g) => g.source === 'human')
  const aiGuesses = guessHistory.filter((g) => g.source === 'AI')
  const gameOverData = stage === 'FINISHED' ? (gameOverVariant === 'victory' ? MOCK_GAME_OVER_VICTORY : MOCK_GAME_OVER_DEFEAT) : null

  const playersWithLastGuess = useMemo(
    () =>
      humanPlayers.map((p) => ({
        name: p.name,
        lastGuess: humanGuesses.find((g) => g.userName === p.name),
      })),
    [humanPlayers, humanGuesses]
  )

  const handleShare = () => {
    setShareFeedback('copied')
    setTimeout(() => setShareFeedback(null), 2000)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h1 className="text-xl font-bold text-slate-100">GM UI dummy</h1>
          <Link to="/dummy/player" className="text-sm text-blue-400 hover:underline">
            Player dummy
          </Link>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Stage:</span>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as GameState)}
              className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200"
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          {stage === 'FINISHED' && (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">Outcome:</span>
              <select
                value={gameOverVariant}
                onChange={(e) => setGameOverVariant(e.target.value as 'victory' | 'defeat')}
                className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200"
              >
                <option value="victory">Victory</option>
                <option value="defeat">Defeat</option>
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={() => setError(error ? '' : 'Sample error for UI debug')}
            className="text-sm px-2 py-1 rounded border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700"
          >
            {error ? 'Clear error' : 'Show error'}
          </button>
        </div>

        <div className="w-full space-y-6">
          {stage === 'FINISHED' && gameOverData && (
            <GameOverScreen
              isVictory={gameOverData.isWin}
              targetWord={gameOverData.targetWord}
              reasonTitle={gameOverData.reasonTitle}
              reasonMessage={gameOverData.reasonMessage}
            >
              <GMGameOverActions
                roomId={DUMMY_ROOM_ID}
                newTargetWord={newTargetWord}
                newTabooWordsStr={newTabooWordsStr}
                onNewTargetWordChange={setNewTargetWord}
                onNewTabooWordsStrChange={setNewTabooWordsStr}
                onRestart={() => setStage('PREPARING')}
              />
            </GameOverScreen>
          )}

          {stage !== 'FINISHED' && (
            <>
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

                {error && (
                  <div className="mb-4 border border-red-500 p-4 bg-red-900/20 text-red-400 font-bold flex gap-3 text-xl">
                    <AlertCircle className="w-7 h-7 flex-shrink-0" />
                    <span>Error: {error}</span>
                  </div>
                )}

                <div className="flex justify-center mb-4">
                  {stage === 'PREPARING' && (
                    <button type="button" onClick={() => setStage('PLAYING')} className="ascii-btn w-full max-w-sm">
                      Start Game
                    </button>
                  )}
                  {stage === 'PLAYING' && (
                    <button
                      type="button"
                      onClick={() => setStage('PREPARING')}
                      className="ascii-btn w-full max-w-sm !bg-red-600 !text-white"
                    >
                      [ ABORT_OPERATION ]
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-6 pb-8">
                  <GMVoicePanel currentTranscript={currentTranscript} />
                  <GMGuessesPanel
                    humanGuesses={humanGuesses}
                    aiGuesses={aiGuesses}
                    isThinking={isThinking}
                    gameState={stage}
                    timeLeft={timeLeft}
                  />
                </div>
              </div>

              <div className="hidden md:block space-y-4">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <div className="relative inline-block">
                    <button
                      type="button"
                      onClick={() => setPlayersPopoverOpen((o) => !o)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-lg font-bold text-blue-400 border border-blue-500/50 bg-blue-900/20 hover:bg-blue-800/30 transition-colors"
                    >
                      <Users className="w-5 h-5" />
                      <span>PLAYERS: {humanPlayers.length}</span>
                      <ChevronDown className={`w-5 h-5 transition-transform ${playersPopoverOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {playersPopoverOpen && (
                      <>
                        <div className="fixed inset-0 z-10" aria-hidden onClick={() => setPlayersPopoverOpen(false)} />
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

                <div className="flex justify-center">
                  <GMDesktopTargetBlock localTargetWord={localTargetWord} localTabooWords={localTabooWords} />
                </div>

                {error && (
                  <div className="mb-4 border border-red-500 p-4 bg-red-900/20 text-red-400 font-bold flex gap-3 text-xl">
                    <AlertCircle className="w-7 h-7 flex-shrink-0" />
                    <span>Error: {error}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
                  {stage === 'PREPARING' && (
                    <button type="button" onClick={() => setStage('PLAYING')} className="ascii-btn">
                      Start Game
                    </button>
                  )}
                  {stage === 'PLAYING' && (
                    <button type="button" onClick={() => setStage('PREPARING')} className="ascii-btn !bg-red-600 !text-white">
                      [ ABORT_OPERATION ]
                    </button>
                  )}
                </div>

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
                      {isThinking && stage === 'PLAYING' && (
                        <span className="text-indigo-400 text-base animate-pulse font-bold tracking-widest">AI thinking...</span>
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
      </div>
    </div>
  )
}
