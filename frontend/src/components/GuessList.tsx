import { Brain, CheckCircle2, User } from 'lucide-react'
import type { ReactNode } from 'react'

export interface GuessListEntry {
  id: number
  text: string
  isWin: boolean
  source?: 'AI' | 'human'
  userName?: string
}

export interface GuessListProps {
  title: ReactNode
  icon?: 'ai' | 'human'
  guesses: GuessListEntry[]
  isThinking: boolean
}

export function GuessList({ title, icon, guesses, isThinking }: GuessListProps) {
  const total = guesses.length

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-indigo-500/10 shrink-0">
        {icon === 'ai' && <Brain className="w-4 h-4 text-indigo-400" />}
        {icon === 'human' && <User className="w-4 h-4 text-amber-400" />}
        {title}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {total === 0 && (
          <p className="text-slate-600 italic text-xs text-center py-4">
            {icon === 'ai' ? 'AI guesses will appear here…' : 'Human guesses will appear here…'}
          </p>
        )}
        {guesses.map((g, index) => {
          const isLatest = index === 0 && !isThinking
          return (
            <div
              key={g.id}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all ${index === 0 ? 'guess-pop-in' : ''} ${
                g.isWin
                  ? 'bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                  : isLatest
                    ? 'bg-indigo-900/50 border-indigo-400/40'
                    : 'bg-slate-800/40 border-slate-700/40'
              }`}
            >
              {g.isWin ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <span className="text-slate-500 text-xs font-mono w-4 text-right shrink-0">{total - index}</span>
              )}
              <span
                className={`font-bold tracking-wide text-base leading-tight flex-1 ${
                  g.isWin ? 'text-emerald-300' : isLatest ? 'text-indigo-100' : 'text-slate-400'
                }`}
              >
                {g.text}
                {g.source && (
                  <span className="ml-2 text-xs text-slate-500">
                    ({g.source === 'AI' ? 'AI' : g.userName || 'Player'})
                  </span>
                )}
              </span>
              {g.isWin && (
                <span className="ml-auto text-xs text-emerald-400 font-semibold uppercase tracking-widest">
                  ✓ Got it!
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

