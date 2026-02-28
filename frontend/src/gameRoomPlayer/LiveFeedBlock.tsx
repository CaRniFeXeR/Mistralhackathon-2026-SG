import { useMemo } from 'react'
import Marquee from 'react-fast-marquee'
import { CountdownLabel } from './CountdownLabel'

export interface LiveFeedBlockProps {
  timeLeft: number
  transcript: string
}

const TRANSCRIPT_PLACEHOLDER = '> LISTENING...'
const TICKER_SPEED_PX_PER_SEC = 220
const SEPARATOR = '  ·  '

/** Normalize to one line for ticker. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export default function LiveFeedBlock({ timeLeft, transcript }: LiveFeedBlockProps) {
  const line = oneLine(transcript)
  const hasContent = line.length > 0
  const tickerText = useMemo(() => (line ? line + SEPARATOR : ''), [line])

  return (
    <div className="w-full min-w-0 overflow-x-hidden ascii-border border-double p-3 mb-2">
      <div className="flex items-center justify-between gap-2 mb-1.5 min-w-0">
        <span className="text-blue-500 text-[10px] font-bold tracking-widest shrink-0">[ LIVE_FEED ]</span>
        <CountdownLabel seconds={timeLeft} />
      </div>
      <div className="ticker-viewport font-mono text-2xl text-green-400 uppercase py-0.5 overflow-x-hidden min-w-0">
        {hasContent ? (
          <Marquee
            speed={TICKER_SPEED_PX_PER_SEC}
            direction="left"
            loop={1}
            gradient={false}
            play={true}
            className="font-mono text-2xl text-green-400 uppercase"
            style={{ overflow: 'hidden' }}
            aria-live="polite"
          >
            {tickerText}
          </Marquee>
        ) : (
          <span className="text-slate-600 opacity-50">{TRANSCRIPT_PLACEHOLDER}</span>
        )}
      </div>
    </div>
  )
}
