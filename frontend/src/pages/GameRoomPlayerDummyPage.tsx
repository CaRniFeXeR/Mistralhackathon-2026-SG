import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import GameOverScreen from '../GameOverScreen'
import ErrorAlert from '../components/ErrorAlert'
import AIGuessPanel from '../gameRoomPlayer/AIGuessPanel'
import LiveFeedBlock from '../gameRoomPlayer/LiveFeedBlock'
import GuessListPanel from '../gameRoomPlayer/GuessListPanel'
import GuessForm from '../gameRoomPlayer/GuessForm'
import VoiceInputSection from '../gameRoomPlayer/VoiceInputSection'
import type { GuessEntry, GameOverData } from '../types/game'

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
          {stage === 'FINISHED' && gameOverData && (
            <GameOverScreen
              isVictory={gameOverData.isWin}
              outcome={gameOverData.outcome}
              targetWord={gameOverData.targetWord}
              reasonTitle={gameOverData.reasonTitle}
              reasonMessage={gameOverData.reasonMessage}
            />
          )}

          {stage !== 'FINISHED' && (
            <>
              {error && (
                <ErrorAlert
                  message={`ERR: ${error}`}
                  icon={<AlertCircle className="w-5 h-5 flex-shrink-0" />}
                  className="mb-4 border border-red-500 p-3 bg-red-900/20 text-red-400 font-bold"
                />
              )}

              {stage === 'PLAYING' ? (
                <div className="flex flex-col w-full max-w-2xl mx-auto min-w-0 overflow-x-hidden" style={{ minHeight: '50dvh' }}>
                  <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden pb-4">
                    <AIGuessPanel lastGuess={aiGuesses[0]} />

                    <LiveFeedBlock timeLeft={timeLeft} transcript={currentTranscript} />

                    <GuessListPanel
                      title="LAST_HUMAN_GUESSES"
                      guesses={humanGuesses.slice(0, 3)}
                      isThinking={isThinking}
                    />

                    <div className="shrink-0 flex flex-col gap-3 pt-1 pb-6">
                      <GuessForm
                        value={currentGuess}
                        onChange={setCurrentGuess}
                        onSubmit={handleSubmitGuess}
                        disabled={stage !== 'PLAYING'}
                        inputRef={guessInputRef}
                        submitLabel={'< SEND />'}
                      />
                      <VoiceInputSection
                        isRecording={isRecording}
                        onToggle={handleVoiceToggle}
                        voiceTranscript={voiceTranscript}
                        lastVoiceGuess={lastVoiceGuess}
                        disabled={stage !== 'PLAYING'}
                        compact={false}
                        largeButton
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                  <p className="text-slate-400 text-lg">Waiting for the Game master to start the game</p>
                  <p className="text-slate-500 text-sm">
                    {playerCount} player{playerCount !== 1 ? 's' : ''} already in the room
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
