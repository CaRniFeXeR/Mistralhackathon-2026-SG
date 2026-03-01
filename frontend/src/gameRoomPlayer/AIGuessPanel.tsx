import type { GuessEntry } from './types'

export interface AIGuessPanelProps {
  lastGuess: GuessEntry | undefined
}

const MAX_LEN = 80
const EMPTY_LABEL = '> NO_AI_GUESS_YET'

export default function AIGuessPanel({ lastGuess }: AIGuessPanelProps) {
  const rawText = lastGuess?.text ?? ''
  const displayText = rawText.length > MAX_LEN ? rawText.slice(0, MAX_LEN) + '…' : rawText
  const isRealGuess = !!lastGuess

  return (
    <div className="shrink-0 mb-2">
      <div className="text-slate-500 text-[10px] font-bold tracking-widest mb-2 border-b border-gray-800 pb-1">
        AI_LAST_GUESS
      </div>
      <div
        key={lastGuess?.id ?? 'empty'}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${isRealGuess ? 'guess-pop-in' : ''
          } ${lastGuess?.isWin
            ? 'bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
            : isRealGuess
              ? 'bg-amber-900/40 border-amber-500/40'
              : 'bg-slate-800/40 border-slate-700/40'
          }`}
      >
        <span className="text-xl shrink-0" aria-hidden>
          🤖
        </span>
        <span
          className={`font-bold tracking-wide text-lg leading-tight ${lastGuess?.isWin
              ? 'text-emerald-300'
              : isRealGuess
                ? 'text-amber-200'
                : 'text-slate-600'
            }`}
        >
          {isRealGuess ? displayText : EMPTY_LABEL}
        </span>
        {lastGuess?.isWin && (
          <span className="ml-auto text-xs text-emerald-400 font-semibold uppercase tracking-widest">
            ✓ Got it!
          </span>
        )}
      </div>
    </div>
  )
}
