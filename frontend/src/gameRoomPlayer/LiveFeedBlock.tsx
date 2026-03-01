import { useEffect, useRef } from 'react'
import { CountdownLabel } from './CountdownLabel'

export interface LiveFeedBlockProps {
  timeLeft: number
  transcript: string
}

const TRANSCRIPT_PLACEHOLDER = '> LISTENING...'
const TICKER_SPEED_PX_PER_SEC = 220
const SEPARATOR = '  ·  '

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function SmoothTicker({ text }: { text: string }) {
  const innerRef = useRef<HTMLDivElement>(null)
  const copy1Ref = useRef<HTMLSpanElement>(null)
  const copy2Ref = useRef<HTMLSpanElement>(null)
  const posRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const prevTimeRef = useRef<number | null>(null)

  // Update both copies directly — no remount, no animation reset
  useEffect(() => {
    const content = (text + SEPARATOR).toUpperCase()
    if (copy1Ref.current) copy1Ref.current.textContent = content
    if (copy2Ref.current) copy2Ref.current.textContent = content
  }, [text])

  useEffect(() => {
    const tick = (timestamp: number) => {
      if (prevTimeRef.current === null) prevTimeRef.current = timestamp
      const dt = Math.min(timestamp - prevTimeRef.current, 100)
      prevTimeRef.current = timestamp

      if (innerRef.current && copy1Ref.current) {
        const halfWidth = copy1Ref.current.getBoundingClientRect().width
        if (halfWidth > 0) {
          posRef.current -= (TICKER_SPEED_PX_PER_SEC * dt) / 1000
          if (posRef.current <= -halfWidth) posRef.current += halfWidth
          innerRef.current.style.transform = `translateX(${posRef.current}px)`
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      prevTimeRef.current = null
    }
  }, [])

  return (
    <div style={{ overflow: 'hidden' }} aria-live="polite">
      <div
        ref={innerRef}
        style={{ display: 'inline-flex', whiteSpace: 'nowrap', willChange: 'transform' }}
      >
        <span ref={copy1Ref} />
        <span ref={copy2Ref} />
      </div>
    </div>
  )
}

export default function LiveFeedBlock({ timeLeft, transcript }: LiveFeedBlockProps) {
  const line = oneLine(transcript)
  const hasContent = line.length > 0

  return (
    <div className="w-full min-w-0 overflow-x-hidden ascii-border border-double p-3 mb-2">
      <div className="flex items-center justify-between gap-2 mb-1.5 min-w-0">
        <span className="text-blue-500 text-[10px] font-bold tracking-widest shrink-0">[ LIVE_FEED ]</span>
        <CountdownLabel seconds={timeLeft} />
      </div>
      <div className="ticker-viewport font-mono text-2xl text-green-400 uppercase py-0.5 overflow-x-hidden min-w-0">
        {hasContent ? (
          <SmoothTicker text={line} />
        ) : (
          <span className="text-slate-600 opacity-50">{TRANSCRIPT_PLACEHOLDER}</span>
        )}
      </div>
    </div>
  )
}
