import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { GuessEntry, GameOverData } from '../types/game'
import GameRoomPlayerView from '../gameRoomPlayer/GameRoomPlayerView'

type PlayerStage = 'WAITING' | 'PLAYING' | 'FINISHED'

const STAGES: PlayerStage[] = ['WAITING', 'PLAYING', 'FINISHED']

const MOCK_AI_GUESS: GuessEntry = {
  id: 1,
  text: 'Big animal',
  isWin: false,
  source: 'AI',
  userName: 'AI',
}
const MOCK_HUMAN_GUESSES: GuessEntry[] = [
  { id: 2, text: 'Mammal', isWin: false, source: 'human', userName: 'Alice' },
  { id: 3, text: 'Elephant', isWin: true, source: 'human', userName: 'Bob' },
]
const MOCK_TRANSCRIPT = "It's a large gray animal with a long nose."
const MOCK_GAME_OVER_YOU_WON: GameOverData = {
  isWin: true,
  targetWord: 'Elephant',
  reasonTitle: 'Target acquired',
  reasonMessage: 'You guessed the word!',
  outcome: 'you_won',
}
const MOCK_GAME_OVER_AI_WON: GameOverData = {
  isWin: false,
  targetWord: 'Elephant',
  reasonTitle: 'Time up',
  reasonMessage: 'AI guessed first.',
  outcome: 'ai_won',
}

export default function GameRoomPlayerDummyPage() {
  const [stage, setStage] = useState<PlayerStage>('PLAYING')
  const [gameOverVariant, setGameOverVariant] = useState<'you_won' | 'ai_won'>('you_won')
  const [timeLeft] = useState(35)
  const [currentTranscript] = useState(MOCK_TRANSCRIPT)
  const [humanGuesses] = useState<GuessEntry[]>(MOCK_HUMAN_GUESSES)
  const [isThinking] = useState(true)
  const [currentGuess, setCurrentGuess] = useState('')
  const [playerCount] = useState(2)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [lastVoiceGuess, setLastVoiceGuess] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState('')

  const guessInputRef = useRef<HTMLInputElement>(null)
  const aiGuesses = stage === 'PLAYING' ? [MOCK_AI_GUESS] : []

  const gameOverData: GameOverData | null =
    stage === 'FINISHED'
      ? gameOverVariant === 'you_won'
        ? MOCK_GAME_OVER_YOU_WON
        : MOCK_GAME_OVER_AI_WON
      : null

  const handleSubmitGuess = (e: React.FormEvent) => {
    e.preventDefault()
    if (currentGuess.trim()) {
      setLastVoiceGuess(null)
      setCurrentGuess('')
    }
  }

  const handleVoiceToggle = () => {
    if (isRecording) {
      setIsRecording(false)
      setLastVoiceGuess(voiceTranscript || 'Elephant')
      setVoiceTranscript('')
    } else {
      setIsRecording(true)
      setVoiceTranscript('')
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h1 className="text-xl font-bold text-slate-100">Player UI dummy</h1>
          <Link to="/dummy/gm" className="text-sm text-blue-400 hover:underline">
            GM dummy
          </Link>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Stage:</span>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as PlayerStage)}
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
                onChange={(e) => setGameOverVariant(e.target.value as 'you_won' | 'ai_won')}
                className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200"
              >
                <option value="you_won">You won</option>
                <option value="ai_won">AI won</option>
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

        <div className="w-full max-w-full min-w-0 overflow-x-hidden space-y-6">
          <GameRoomPlayerView
            gameState={stage}
            gameOverData={gameOverData}
            error={error}
            aiGuesses={aiGuesses}
            timeLeft={timeLeft}
            currentTranscript={currentTranscript}
            humanGuesses={humanGuesses}
            isThinking={isThinking}
            currentGuess={currentGuess}
            onCurrentGuessChange={setCurrentGuess}
            onSubmitGuess={handleSubmitGuess}
            guessInputRef={guessInputRef}
            isRecording={isRecording}
            onToggleRecording={handleVoiceToggle}
            voiceTranscript={voiceTranscript}
            lastVoiceGuess={lastVoiceGuess}
            playerCount={playerCount}
          />
        </div>
      </div>
    </div>
  )
}
