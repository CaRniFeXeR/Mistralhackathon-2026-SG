import { AlertCircle, ChevronDown, Clock, Share2, User, Users } from 'lucide-react'
import GameOverScreen from '../GameOverScreen'
import type { GameState, GuessEntry, GameOverData } from './types'
import GMGameOverActions from './GMGameOverActions'
import GMPlayingHeader from './GMPlayingHeader'
import GMVoicePanel from './GMVoicePanel'
import GMGuessesPanel from './GMGuessesPanel'
import GMDesktopTargetBlock from './GMDesktopTargetBlock'
import GMPlayersWithGuesses from './GMPlayersWithGuesses'
import LabeledPanel from '../components/LabeledPanel'
import GuessFeedColumn from './GuessFeedColumn'
import { ASCII_PANEL_CLASS } from './utils'

interface PlayersWithLastGuessEntry {
  name: string
  lastGuess: GuessEntry | undefined
}

export interface GameRoomGMViewProps {
  roomId: string
  gameState: GameState
  gameOverData: GameOverData | null
  localTargetWord: string
  localTabooWords: string[]
  humanPlayers: { name: string }[]
  playersPopoverOpen: boolean
  shareFeedback: 'copied' | null
  error: string
  currentTranscript: string
  humanGuesses: GuessEntry[]
  aiGuesses: GuessEntry[]
  isThinking: boolean
  timeLeft: number
  playersWithLastGuess: PlayersWithLastGuessEntry[]
  newTargetWord: string
  newTabooWordsStr: string
  onPlayersPopoverToggle: () => void
  onPlayersPopoverClose: () => void
  onShare: () => void | Promise<void>
  onStartGame: () => void
  onAbortGame: () => void
  onNewTargetWordChange: (value: string) => void
  onNewTabooWordsStrChange: (value: string) => void
  onRestart: () => void
}

export default function GameRoomGMView({
  roomId,
  gameState,
  gameOverData,
  localTargetWord,
  localTabooWords,
  humanPlayers,
  playersPopoverOpen,
  shareFeedback,
  error,
  currentTranscript,
  humanGuesses,
  aiGuesses,
  isThinking,
  timeLeft,
  playersWithLastGuess,
  newTargetWord,
  newTabooWordsStr,
  onPlayersPopoverToggle,
  onPlayersPopoverClose,
  onShare,
  onStartGame,
  onAbortGame,
  onNewTargetWordChange,
  onNewTabooWordsStrChange,
  onRestart,
}: GameRoomGMViewProps) {
  return (
    <div className="w-full max-w-full md:max-w-4xl md:mx-auto space-y-6">
      {gameState === 'FINISHED' && gameOverData && (
        <GameOverScreen
          isVictory={gameOverData.isWin}
          targetWord={gameOverData.targetWord}
          reasonTitle={gameOverData.reasonTitle}
          reasonMessage={gameOverData.reasonMessage}
        >
          <GMGameOverActions
            roomId={roomId}
            newTargetWord={newTargetWord}
            newTabooWordsStr={newTabooWordsStr}
            onNewTargetWordChange={onNewTargetWordChange}
            onNewTabooWordsStrChange={onNewTabooWordsStrChange}
            onRestart={onRestart}
          />
        </GameOverScreen>
      )}

      {gameState !== 'FINISHED' && (
        <>
          <div className="block md:hidden space-y-6">
            <GMPlayingHeader
              localTargetWord={localTargetWord}
              localTabooWords={localTabooWords}
              humanPlayers={humanPlayers}
              playersPopoverOpen={playersPopoverOpen}
              shareFeedback={shareFeedback}
              gameState={gameState}
              onPlayersPopoverToggle={onPlayersPopoverToggle}
              onPlayersPopoverClose={onPlayersPopoverClose}
              onShare={onShare}
              onStartGame={onStartGame}
              onAbortGame={onAbortGame}
            />

            {error && (
              <div className="mb-4 border border-red-500 p-4 bg-red-900/20 text-red-400 font-bold flex gap-3 text-xl">
                <AlertCircle className="w-7 h-7 flex-shrink-0" />
                <span>Error: {error}</span>
              </div>
            )}

            {gameState === 'PLAYING' && (
              <div className="grid grid-cols-1 gap-6 pb-8">
                <GMVoicePanel currentTranscript={currentTranscript} />
                <GMGuessesPanel
                  humanGuesses={humanGuesses}
                  aiGuesses={aiGuesses}
                  isThinking={isThinking}
                  gameState={gameState}
                  timeLeft={timeLeft}
                />
              </div>
            )}
          </div>

          <div className="hidden md:block">
            {error && (
              <div className="mb-4 border border-red-500 p-4 bg-red-900/20 text-red-400 font-bold flex gap-3 text-xl">
                <AlertCircle className="w-7 h-7 flex-shrink-0" />
                <span>Error: {error}</span>
              </div>
            )}

            {/* Single two-column grid: top bar + content aligned to same columns */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 pb-8 items-start">
              {/* Row 1 – left: Players + Share */}
              <div className="flex items-center gap-3">
                <div className="relative inline-block">
                  <button
                    type="button"
                    onClick={onPlayersPopoverToggle}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-indigo-400 border border-indigo-500/50 bg-indigo-900/20 hover:bg-indigo-800/30 transition-colors"
                  >
                    <Users className="w-4 h-4" />
                    <span>PLAYERS: {humanPlayers.length}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${playersPopoverOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {playersPopoverOpen && (
                    <>
                      <div className="fixed inset-0 z-10" aria-hidden onClick={onPlayersPopoverClose} />
                      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 min-w-[200px] py-2 bg-black border border-indigo-500 shadow-xl">
                        {humanPlayers.length === 0 ? (
                          <p className="px-4 py-2 text-slate-500 text-base">No players yet</p>
                        ) : (
                          <ul className="text-left text-blue-300">
                            {humanPlayers.map((p, i) => (
                              <li key={i} className="flex items-center gap-2 px-4 py-2 hover:bg-blue-900/30 font-mono text-base">
                                <User className="w-4 h-4 text-indigo-500" />
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
                  onClick={onShare}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-indigo-400 border border-indigo-500/50 bg-indigo-900/20 hover:bg-indigo-800/30 transition-colors"
                  title="Share room link"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{shareFeedback === 'copied' ? 'LINK COPIED' : 'SHARE LINK'}</span>
                </button>
              </div>

              {/* Row 1 – right: Start / Abort */}
              <div className="flex justify-end">
                {gameState === 'PREPARING' && (
                  <button type="button" onClick={onStartGame} className="ascii-btn">
                    Start Game
                  </button>
                )}
                {gameState === 'PLAYING' && (
                  <button
                    type="button"
                    onClick={onAbortGame}
                    className="ascii-btn !bg-red-600 !text-white"
                  >
                    [ ABORT ]
                  </button>
                )}
              </div>

              {/* Row 2 – left: Timer + Describe word + Live transcript */}
              <div className="flex flex-col gap-4 min-w-0">
                {gameState === 'PLAYING' && (
                  <div className="flex items-center justify-center gap-3 px-4 py-3 border border-blue-500/30 bg-blue-900/10">
                    <Clock className="w-6 h-6 text-blue-400 shrink-0" />
                    <span className={`text-3xl font-black tabular-nums ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-blue-400'}`}>
                      {timeLeft.toString().padStart(2, '0')}s
                    </span>
                  </div>
                )}
                <GMDesktopTargetBlock
                  localTargetWord={localTargetWord}
                  localTabooWords={localTabooWords}
                />
                <GMVoicePanel currentTranscript={currentTranscript} />
              </div>

              {/* Row 2 – right: Players guesses + AI guesses (pt aligns with bottom of timer when playing) */}
              <div
                className={`flex flex-col gap-4 min-w-0 ${gameState === 'PLAYING' ? 'pt-[4.375rem]' : ''}`}
              >
                <GMPlayersWithGuesses playersWithLastGuess={playersWithLastGuess} />
                <LabeledPanel label="[ AI GUESSES ]" panelClassName={ASCII_PANEL_CLASS} className="!h-auto min-h-[140px]">
                  <div className="mt-2 flex-1 min-h-0">
                    <GuessFeedColumn
                      title={`🤖 AI [${aiGuesses.length}]`}
                      titleClassName="text-amber-400"
                      guesses={aiGuesses}
                      isThinking={isThinking}
                    />
                  </div>
                </LabeledPanel>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
