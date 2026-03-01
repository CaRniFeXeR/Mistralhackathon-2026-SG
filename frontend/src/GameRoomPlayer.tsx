import { useEffect } from 'react'
import { useGameRoomPlayerState } from './gameRoomPlayer/useGameRoomPlayerState'
import GameRoomPlayerView from './gameRoomPlayer/GameRoomPlayerView'

export type PlayerGameState = 'WAITING' | 'PLAYING' | 'FINISHED'

export interface GameRoomPlayerProps {
  roomId: string
  token: string
  onNewGamePreparing?: () => void
  onStateChange?: (state: PlayerGameState) => void
}

export default function GameRoomPlayer({ roomId, token, onNewGamePreparing, onStateChange }: GameRoomPlayerProps) {
  const {
    state: {
      gameState,
      timeLeft,
      currentTranscript,
      isThinking,
      error,
      gameOverData,
      currentGuess,
      playerCount,
      voiceTranscript,
      lastVoiceGuess,
      guessHistory,
      isRecording,
    },
    handlers: { setCurrentGuess, handleSubmitGuess, startRecording, stopRecording },
    refs: { guessInputRef },
  } = useGameRoomPlayerState({ roomId, token, onNewGamePreparing })

  useEffect(() => {
    onStateChange?.(gameState)
  }, [gameState, onStateChange])

  const humanGuesses = guessHistory.filter((g) => g.source === 'human')
  const aiGuesses = guessHistory.filter((g) => g.source === 'AI')

  return (
    <GameRoomPlayerView
      gameState={gameState}
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
      onToggleRecording={() => {
        void (isRecording ? stopRecording() : startRecording())
      }}
      voiceTranscript={voiceTranscript}
      lastVoiceGuess={lastVoiceGuess}
      playerCount={playerCount}
    />
  )
}
