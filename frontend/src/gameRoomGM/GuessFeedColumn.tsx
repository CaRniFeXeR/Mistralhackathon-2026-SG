import type { GuessEntry } from './types'
import GuessRow from './GuessRow'

export interface GuessFeedColumnProps {
  title: string
  titleClassName?: string
  guesses: GuessEntry[]
  isThinking: boolean
}

export default function GuessFeedColumn({
  title,
  titleClassName = '',
  guesses,
  isThinking,
}: GuessFeedColumnProps) {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className={`text-base font-bold tracking-widest mb-2 shrink-0 border-b border-gray-800 pb-1 ${titleClassName}`}>
        {title}
      </div>
      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        {guesses.length === 0 ? (
          <p className="text-slate-700 text-base py-2">No guesses yet</p>
        ) : (
          guesses.map((g, i) => (
            <GuessRow
              key={g.id}
              guess={g}
              totalInFeed={guesses.length}
              indexInFeed={i}
              isThinking={isThinking}
            />
          ))
        )}
      </div>
    </div>
  )
}
