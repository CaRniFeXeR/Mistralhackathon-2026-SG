import { AlertCircle } from 'lucide-react'
import GameOverScreen from './GameOverScreen'
import ErrorAlert from './components/ErrorAlert'
import { useGameRoomPlayerState } from './gameRoomPlayer/useGameRoomPlayerState'
import LiveFeedBlock from './gameRoomPlayer/LiveFeedBlock'
import GuessListPanel from './gameRoomPlayer/GuessListPanel'
import GuessForm from './gameRoomPlayer/GuessForm'
import VoiceInputSection from './gameRoomPlayer/VoiceInputSection'
import PlayerCountBadge from './gameRoomPlayer/PlayerCountBadge'
import TargetAcquisitionPanel from './gameRoomPlayer/TargetAcquisitionPanel'
import AnalysisTerminalPanel from './gameRoomPlayer/AnalysisTerminalPanel'

export interface GameRoomPlayerProps {
  roomId: string
  token: string
}

export default function GameRoomPlayer({ roomId, token }: GameRoomPlayerProps) {
  const {
    state: {
      gameState,
      timeLeft,
      currentTranscript,
      guessExcerpt,
      isThinking,
      error,
      gameOverData,
      currentGuess,
      playerCount,
      playerNumber,
      playerBadgeBlink,
      voiceTranscript,
      lastVoiceGuess,
      isGuessInputFocused,
      guessHistory,
      isRecording,
    },
    handlers: { setCurrentGuess, setIsGuessInputFocused, handleSubmitGuess, startRecording, stopRecording },
    refs: { guessInputRef },
  } = useGameRoomPlayerState({ roomId, token })

  const humanGuesses = guessHistory.filter((g) => g.source === 'human')
  const aiGuesses = guessHistory.filter((g) => g.source === 'AI')

  return (
    <div className="w-full space-y-6">
      {gameState === 'FINISHED' && gameOverData && (
        <GameOverScreen
          isVictory={gameOverData.isWin}
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
              className="flex flex-col w-full max-w-2xl mx-auto"
              style={{ minHeight: '50dvh' }}
            >
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden pb-4">
                <LiveFeedBlock timeLeft={timeLeft} transcript={currentTranscript} />

                <GuessListPanel
                  title="LAST_GUESSES"
                  guesses={guessExcerpt}
                  isThinking={isThinking}
                />

                <div className="shrink-0 space-y-2 pt-1 pb-6">
                  <GuessForm
                    value={currentGuess}
                    onChange={setCurrentGuess}
                    onSubmit={handleSubmitGuess}
                    disabled={gameState !== 'PLAYING'}
                    inputRef={guessInputRef}
                    submitLabel={'< SEND />'}
                    onFocus={() => setIsGuessInputFocused(true)}
                    onBlur={() => setIsGuessInputFocused(false)}
                  />

                  {!isGuessInputFocused && (
                    <VoiceInputSection
                      isRecording={isRecording}
                      onToggle={() => { void (isRecording ? stopRecording() : startRecording()) }}
                      voiceTranscript={voiceTranscript}
                      lastVoiceGuess={lastVoiceGuess}
                      disabled={gameState !== 'PLAYING'}
                      compact={false}
                    />
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              <PlayerCountBadge
                playerCount={playerCount}
                playerNumber={playerNumber}
                blink={playerBadgeBlink}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
                <TargetAcquisitionPanel transcript={currentTranscript} />
                <AnalysisTerminalPanel
                  timeLeft={timeLeft}
                  humanGuesses={humanGuesses}
                  aiGuesses={aiGuesses}
                  isThinking={isThinking}
                />
              </div>

              <div className="w-full max-w-2xl space-y-4 pb-8">
                <div className="flex items-center justify-between text-xs text-slate-500 px-1 border-b border-gray-800 pb-2">
                  <span className="font-bold tracking-widest">
                    INPUT_METHOD: <span className="text-blue-400">KEYBOARD</span> | <span className="text-blue-400">VOICE</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="inline-flex h-2 w-2 bg-slate-700" />
                    <span className="uppercase tracking-widest font-bold">SYSTEM_LOCKED</span>
                  </span>
                </div>
                <div className="flex w-full items-center gap-3">
                  <GuessForm
                    value={currentGuess}
                    onChange={setCurrentGuess}
                    onSubmit={handleSubmitGuess}
                    disabled
                    submitLabel={'< GUESS />'}
                    inputClassName="terminal-input w-full"
                    formClassName="flex flex-1 min-w-0 items-center gap-3"
                  />
                  <VoiceInputSection
                    isRecording={isRecording}
                    onToggle={() => { void (isRecording ? stopRecording() : startRecording()) }}
                    voiceTranscript={voiceTranscript}
                    lastVoiceGuess={lastVoiceGuess}
                    disabled
                    compact
                    buttonOnly
                  />
                </div>

                {(isRecording || voiceTranscript || (lastVoiceGuess != null && lastVoiceGuess !== '')) && (
                  <VoiceInputSection
                    isRecording={isRecording}
                    onToggle={() => {}}
                    voiceTranscript={voiceTranscript}
                    lastVoiceGuess={lastVoiceGuess}
                    disabled
                    compact
                    showButton={false}
                  />
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
