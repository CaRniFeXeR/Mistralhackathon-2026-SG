import { Brain, CheckCircle2, User } from 'lucide-react'
import type { GuessEntry } from './types'

export interface GuessRowProps {
  guess: GuessEntry
  totalInFeed: number
  indexInFeed: number
  isThinking: boolean
}

export default function GuessRow({ guess: g, totalInFeed, indexInFeed, isThinking }: GuessRowProps) {
  const isLatest = indexInFeed === 0 && !isThinking
  const boxClass = g.isWin
    ? 'bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
    : isLatest
      ? 'bg-indigo-900/50 border-indigo-400/40'
      : 'bg-slate-800/40 border-slate-700/40'
  const textClass = g.isWin ? 'text-emerald-300' : isLatest ? 'text-indigo-100' : 'text-slate-400'
  const badgeClass =
    g.source === 'AI'
      ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/40'
      : 'bg-amber-500/20 text-amber-200 border border-amber-400/40'

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${indexInFeed === 0 ? 'guess-pop-in' : ''} ${boxClass}`}
    >
      {g.isWin ? (
        <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
      ) : (
        <span className="text-slate-500 text-sm font-mono w-5 text-right shrink-0">
          {totalInFeed - indexInFeed}
        </span>
      )}
      <span className={`font-bold tracking-wide text-2xl leading-tight flex-1 ${textClass}`}>{g.text}</span>
      <span className={`inline-flex items-center gap-1.5 shrink-0 px-3 py-1 rounded-full text-base font-semibold ${badgeClass}`}>
        {g.source === 'AI' ? (
          <>
            <Brain className="w-4 h-4" />
            AI
          </>
        ) : (
          <>
            <User className="w-4 h-4" />
            {g.userName || 'Player'}
          </>
        )}
      </span>
      {g.isWin && (
        <span className="ml-auto text-base text-emerald-400 font-semibold uppercase tracking-widest">✓ Got it!</span>
      )}
    </div>
  )
}
