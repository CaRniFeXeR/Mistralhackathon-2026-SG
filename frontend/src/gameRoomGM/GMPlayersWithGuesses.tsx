import { User } from 'lucide-react'
import LabeledPanel from '../components/LabeledPanel'
import type { GuessEntry } from './types'
import { ASCII_PANEL_CLASS } from './utils'

export interface PlayerWithLastGuess {
  name: string
  lastGuess: GuessEntry | undefined
}

export interface GMPlayersWithGuessesProps {
  playersWithLastGuess: PlayerWithLastGuess[]
}

export default function GMPlayersWithGuesses({ playersWithLastGuess }: GMPlayersWithGuessesProps) {
  return (
    <LabeledPanel label="[ PLAYER GUESSES ]" panelClassName={ASCII_PANEL_CLASS} className="!h-auto min-h-[200px] flex-1 flex flex-col min-h-0">
      <div className="mt-2 flex-1 overflow-y-auto space-y-2 pr-2 min-h-0">
        {playersWithLastGuess.length === 0 ? (
          <p className="text-slate-500 text-base py-2">No players yet</p>
        ) : (
          playersWithLastGuess.map(({ name, lastGuess }, i) => (
            <div
              key={i}
              className="flex flex-col gap-1 px-3 py-2 rounded-lg border border-slate-700/50 bg-slate-800/30"
            >
              <div className="flex items-center gap-2 text-indigo-400 font-mono font-bold text-lg">
                <User className="w-4 h-4 text-indigo-500 shrink-0" />
                {name || 'Unknown'}
              </div>
              <div className="text-slate-400 font-mono text-base pl-6">
                {lastGuess ? (
                  <span className={lastGuess.isWin ? 'text-emerald-400' : ''}>{lastGuess.text}</span>
                ) : (
                  <span className="text-slate-600">—</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </LabeledPanel>
  )
}
