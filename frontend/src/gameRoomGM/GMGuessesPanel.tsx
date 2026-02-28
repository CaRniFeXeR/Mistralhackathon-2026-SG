import { Clock } from 'lucide-react'
import LabeledPanel from '../components/LabeledPanel'
import GuessFeedColumn from './GuessFeedColumn'
import type { GuessEntry } from './types'
import { ASCII_PANEL_CLASS } from './utils'

export interface GMGuessesPanelProps {
  humanGuesses: GuessEntry[]
  aiGuesses: GuessEntry[]
  isThinking: boolean
  gameState: 'PREPARING' | 'PLAYING' | 'FINISHED'
  timeLeft: number
}

export default function GMGuessesPanel({
  humanGuesses,
  aiGuesses,
  isThinking,
  gameState,
  timeLeft,
}: GMGuessesPanelProps) {
  return (
    <LabeledPanel label="[ GUESSES ]" panelClassName={ASCII_PANEL_CLASS}>
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
          <GuessFeedColumn
            title={`👤 Humans [${humanGuesses.length}]`}
            titleClassName="text-amber-500"
            guesses={humanGuesses}
            isThinking={isThinking}
          />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <GuessFeedColumn
            title={`🤖 AI [${aiGuesses.length}]`}
            titleClassName="text-indigo-400"
            guesses={aiGuesses}
            isThinking={isThinking}
          />
        </div>
      </div>
    </LabeledPanel>
  )
}
