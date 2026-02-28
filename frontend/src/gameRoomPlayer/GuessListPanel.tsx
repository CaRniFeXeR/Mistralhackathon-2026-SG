import type { GuessEntry } from './types'
import GuessRow from './GuessRow'

export interface GuessListPanelProps {
  title: string
  guesses: GuessEntry[]
  isThinking: boolean
  emptyLabel?: string
  /** When false, no outer border (for use inside another panel e.g. AnalysisTerminalPanel). */
  bordered?: boolean
  titleClassName?: string
}

const DEFAULT_EMPTY_LABEL = '> NO_DATA'

export default function GuessListPanel({
  title,
  guesses,
  isThinking,
  emptyLabel = DEFAULT_EMPTY_LABEL,
  bordered = true,
  titleClassName = '',
}: GuessListPanelProps) {
  const wrapperClass = bordered
    ? 'flex-1 min-h-0 overflow-y-auto ascii-border border-double p-3 mb-2'
    : 'flex-1 flex flex-col min-w-0 overflow-hidden'
  const titleClass = bordered
    ? 'text-slate-500 text-[10px] font-bold tracking-widest mb-2 border-b border-gray-800 pb-1'
    : `text-[10px] font-bold tracking-widest mb-2 shrink-0 border-b border-gray-800 pb-1 ${titleClassName}`
  return (
    <div className={wrapperClass}>
      <div className={titleClass}>
        {title} [{guesses.length}]
      </div>
      <div className={`flex-1 overflow-y-auto min-h-0 ${bordered ? 'space-y-1.5' : 'space-y-1 pr-1'}`}>
        {guesses.length === 0 && (
          <p className="text-slate-700 text-xs py-1">{emptyLabel}</p>
        )}
        {guesses.map((g, i) => (
          <GuessRow
            key={g.id}
            g={g}
            totalInFeed={guesses.length}
            indexInFeed={i}
            isThinking={isThinking}
          />
        ))}
      </div>
    </div>
  )
}
