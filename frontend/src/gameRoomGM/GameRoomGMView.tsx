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
    <div className="w-full space-y-6">
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

          <div className="hidden md:block space-y-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <div className="relative inline-block">
                <button
                  type="button"
                  onClick={onPlayersPopoverToggle}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-blue-400 border border-blue-500/50 bg-blue-900/20 hover:bg-blue-800/30 transition-colors"
                >
                  <Users className="w-4 h-4" />
                  <span>PLAYERS: {humanPlayers.length}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${playersPopoverOpen ? 'rotate-180' : ''}`} />
                </button>
                {playersPopoverOpen && (
                  <>
                    <div className="fixed inset-0 z-10" aria-hidden onClick={onPlayersPopoverClose} />
                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 min-w-[200px] py-2 bg-black border border-blue-500 shadow-xl">
                      {humanPlayers.length === 0 ? (
                        <p className="px-4 py-2 text-slate-500 text-base">No players yet</p>
                      ) : (
                        <ul className="text-left text-blue-300">
                          {humanPlayers.map((p, i) => (
                            <li key={i} className="flex items-center gap-2 px-4 py-2 hover:bg-blue-900/30 font-mono text-base">
                              <User className="w-4 h-4 text-blue-500" />
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-emerald-400 border border-emerald-500/50 bg-emerald-900/20 hover:bg-emerald-800/30 transition-colors"
                title="Share room link"
              >
                <Share2 className="w-4 h-4" />
                <span>{shareFeedback === 'copied' ? 'LINK COPIED' : 'SHARE LINK'}</span>
              </button>

              <div className="w-1/3 flex justify-center">
                {gameState === 'PREPARING' && (
                  <button type="button" onClick={onStartGame} className="ascii-btn w-full">
                    Start Game
                  </button>
                )}
                {gameState === 'PLAYING' && (
                  <button
                    type="button"
                    onClick={onAbortGame}
                    className="ascii-btn w-full !bg-red-600 !text-white"
                  >
                    [ ABORT_OPERATION ]
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-center">
              <GMDesktopTargetBlock
                localTargetWord={localTargetWord}
                localTabooWords={localTabooWords}
              />
            </div>

            {error && (
              <div className="mb-4 border border-red-500 p-4 bg-red-900/20 text-red-400 font-bold flex gap-3 text-xl">
                <AlertCircle className="w-7 h-7 flex-shrink-0" />
                <span>Error: {error}</span>
              </div>
            )}

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
                  {isThinking && gameState === 'PLAYING' && (
                    <span className="text-indigo-400 text-base animate-pulse font-bold tracking-widest">
                      AI thinking...
                    </span>
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
  )
}
