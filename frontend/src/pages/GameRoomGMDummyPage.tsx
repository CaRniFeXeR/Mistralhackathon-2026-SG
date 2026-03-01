import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { GameState, GuessEntry, GameOverData } from '../gameRoomGM/types'
import GameRoomGMView from '../gameRoomGM/GameRoomGMView'

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

        <GameRoomGMView
          roomId={DUMMY_ROOM_ID}
          gameState={stage}
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
          onShare={handleShare}
          onStartGame={() => setStage('PLAYING')}
          onAbortGame={() => setStage('PREPARING')}
          onNewTargetWordChange={setNewTargetWord}
          onNewTabooWordsStrChange={setNewTabooWordsStr}
          onRestart={() => setStage('PREPARING')}
        />
      </div>
    </div>
  )
}
