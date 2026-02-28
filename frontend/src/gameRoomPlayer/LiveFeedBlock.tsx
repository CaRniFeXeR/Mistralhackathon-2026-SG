import { CountdownLabel } from './CountdownLabel'

export interface LiveFeedBlockProps {
  timeLeft: number
  transcript: string
}

const TRANSCRIPT_PLACEHOLDER = '> LISTENING...'

export default function LiveFeedBlock({ timeLeft, transcript }: LiveFeedBlockProps) {
  return (
    <div className="shrink-0 ascii-border border-double p-3 mb-2">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-blue-500 text-[10px] font-bold tracking-widest">[ LIVE_FEED ]</span>
        <CountdownLabel seconds={timeLeft} />
      </div>
      <div className="font-mono text-xs text-green-400 leading-snug uppercase line-clamp-3">
        {transcript || <span className="text-slate-600 opacity-50">{TRANSCRIPT_PLACEHOLDER}</span>}
      </div>
    </div>
  )
}
