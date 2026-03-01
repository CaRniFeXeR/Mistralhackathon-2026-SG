import type { FormEvent, RefObject } from 'react'
import { AlertCircle } from 'lucide-react'
import GameOverScreen from '../GameOverScreen'
import ErrorAlert from '../components/ErrorAlert'
import AIGuessPanel from './AIGuessPanel'
import LiveFeedBlock from './LiveFeedBlock'
import GuessListPanel from './GuessListPanel'
import GuessForm from './GuessForm'
import VoiceInputSection from './VoiceInputSection'
import type { GameOverData, GuessEntry } from '../types/game'

export type PlayerViewState = 'WAITING' | 'PLAYING' | 'FINISHED'

export interface GameRoomPlayerViewProps {
  gameState: PlayerViewState
  gameOverData: GameOverData | null
  error: string
  aiGuesses: GuessEntry[]
  timeLeft: number
  currentTranscript: string
  humanGuesses: GuessEntry[]
  isThinking: boolean
  currentGuess: string
  onCurrentGuessChange: (value: string) => void
  onSubmitGuess: (event: FormEvent) => void
  guessInputRef: RefObject<HTMLInputElement | null>
  isRecording: boolean
  onToggleRecording: () => void
  voiceTranscript: string
  lastVoiceGuess: string | null
  playerCount: number
}

export default function GameRoomPlayerView({
  gameState,
  gameOverData,
  error,
  aiGuesses,
  timeLeft,
  currentTranscript,
  humanGuesses,
  isThinking,
  currentGuess,
  onCurrentGuessChange,
  onSubmitGuess,
  guessInputRef,
  isRecording,
  onToggleRecording,
  voiceTranscript,
  lastVoiceGuess,
  playerCount,
}: GameRoomPlayerViewProps) {
  return (
    <div className="w-full max-w-full min-w-0 overflow-x-hidden space-y-6">
      {gameState === 'FINISHED' && gameOverData && (
        <GameOverScreen
          isVictory={gameOverData.isWin}
          outcome={gameOverData.outcome}
          targetWord={gameOverData.targetWord}
          reasonTitle={gameOverData.reasonTitle}
          reasonMessage={gameOverData.reasonMessage}
        />
      )}

      {gameState !== 'FINISHED' && (
        <>
          {error && (
            <ErrorAlert
              message={`ERR: ${error}`}
              icon={<AlertCircle className="w-5 h-5 flex-shrink-0" />}
              className="mb-4 border border-red-500 p-3 bg-red-900/20 text-red-400 font-bold"
            />
          )}

          {gameState === 'PLAYING' ? (
            <div
              className="flex flex-col w-full max-w-2xl mx-auto min-w-0 overflow-x-hidden"
              style={{ minHeight: '50dvh' }}
            >
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
                    onChange={onCurrentGuessChange}
                    onSubmit={onSubmitGuess}
                    disabled={gameState !== 'PLAYING'}
                    inputRef={guessInputRef}
                    submitLabel={'< SEND />'}
                  />
                  <VoiceInputSection
                    isRecording={isRecording}
                    onToggle={onToggleRecording}
                    voiceTranscript={voiceTranscript}
                    lastVoiceGuess={lastVoiceGuess}
                    disabled={gameState !== 'PLAYING'}
                    compact={false}
                    largeButton
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <img
                src="/pixel-cat-animated.svg"
                alt="Pixel Cat"
                className="w-40 h-40 object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
              <p className="text-slate-400 text-lg">
                Waiting for the Game master to start the game
              </p>
              <p className="text-slate-500 text-sm">
                {playerCount} player{playerCount !== 1 ? 's' : ''} already in the room
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
