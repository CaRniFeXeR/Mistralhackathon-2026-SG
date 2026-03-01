import { CheckCircle2 } from 'lucide-react'
import type { GuessEntry } from './types'

export interface GuessRowProps {
  g: GuessEntry
  totalInFeed: number
  indexInFeed: number
  isThinking: boolean
}

export default function GuessRow({ g, totalInFeed, indexInFeed, isThinking }: GuessRowProps) {
  const isLatest = indexInFeed === 0 && !isThinking
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${indexInFeed === 0 ? 'guess-pop-in' : ''} ${g.isWin
        ? 'bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
        : isLatest
          ? 'bg-indigo-900/50 border-indigo-400/40'
          : 'bg-slate-800/40 border-slate-700/40'
        }`}
    >
      {g.isWin ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
      ) : (
        <span className="text-slate-500 text-sm font-mono w-5 text-right shrink-0">
          {totalInFeed - indexInFeed}
        </span>
      )}
      <span
        className={`font-bold tracking-wide text-lg leading-tight ${g.isWin ? 'text-emerald-300' : isLatest ? 'text-indigo-100' : 'text-slate-400'
          }`}
      >
        {g.text}
        <span className={`ml-2 text-sm font-semibold ${g.source === 'AI' ? 'text-amber-400' : 'text-indigo-400'}`}>
          {g.source === 'AI' ? '🤖 AI' : `👤 ${g.userName || 'Player'}`}
        </span>
      </span>
      {g.isWin && (
        <span className="ml-auto text-xs text-emerald-400 font-semibold uppercase tracking-widest">
          ✓ Got it!
        </span>
      )}
    </div>
  )
}
