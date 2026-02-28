import type { GuessEntry } from './types'

export interface AIGuessPanelProps {
  lastGuess: GuessEntry | undefined
}

const EMPTY_LABEL = '> NO_AI_GUESS_YET'

export default function AIGuessPanel({ lastGuess }: AIGuessPanelProps) {
  const text = lastGuess?.text ?? EMPTY_LABEL
  const isRealGuess = !!lastGuess
  return (
    <div className="shrink-0 ascii-border border-double p-3 mb-2">
      <div
        key={lastGuess?.id ?? 'empty'}
        className="flex items-center gap-2"
        style={
          isRealGuess
            ? {
                animation: 'guessPopIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both',
              }
            : undefined
        }
      >
        <span className="text-xl shrink-0" aria-hidden>
          🤖
        </span>
        <span className="font-mono text-lg text-slate-300 leading-snug uppercase">
          {text}
        </span>
      </div>
    </div>
  )
}
