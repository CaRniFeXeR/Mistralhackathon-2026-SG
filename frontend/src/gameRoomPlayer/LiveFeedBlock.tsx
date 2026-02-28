import { CountdownLabel } from './CountdownLabel'

export interface LiveFeedBlockProps {
  timeLeft: number
  transcript: string
}

const TRANSCRIPT_PLACEHOLDER = '> LISTENING...'

/** Normalize to one line for ticker; duplicate so we can loop scroll. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export default function LiveFeedBlock({ timeLeft, transcript }: LiveFeedBlockProps) {
  const line = oneLine(transcript)
  const hasContent = line.length > 0
  const tickerText = hasContent ? `${line}  ·  ${line}  ·  ` : ''

  return (
    <div className="shrink-0 ascii-border border-double p-3 mb-2">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-blue-500 text-[10px] font-bold tracking-widest">[ LIVE_FEED ]</span>
        <CountdownLabel seconds={timeLeft} />
      </div>
      <div className="ticker-viewport font-mono text-xs text-green-400 uppercase py-0.5">
        {hasContent ? (
          <span
            className="ticker-content"
            key={line}
            style={{ animationDuration: `${Math.max(15, line.length * 0.12)}s` }}
          >
            {tickerText}
          </span>
        ) : (
          <span className="text-slate-600 opacity-50">{TRANSCRIPT_PLACEHOLDER}</span>
        )}
      </div>
    </div>
  )
}
