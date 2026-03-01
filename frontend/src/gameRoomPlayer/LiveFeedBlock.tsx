import { useEffect, useRef } from 'react'
import { CountdownLabel } from './CountdownLabel'

export interface LiveFeedBlockProps {
  timeLeft: number
  transcript: string
}

const TRANSCRIPT_PLACEHOLDER = '> LISTENING...'
const SCROLL_PX_PER_SEC = 200

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function SmoothTicker({ text }: { text: string }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const spanRef = useRef<HTMLSpanElement>(null)
  const posRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const prevTimeRef = useRef<number | null>(null)

  useEffect(() => {
    if (!spanRef.current) return
    spanRef.current.textContent = text
  }, [text])

  useEffect(() => {
    const tick = (timestamp: number) => {
      if (prevTimeRef.current === null) prevTimeRef.current = timestamp
      const dt = Math.min(timestamp - prevTimeRef.current, 100)
      prevTimeRef.current = timestamp

      if (innerRef.current && spanRef.current && viewportRef.current) {
        const vw = viewportRef.current.offsetWidth
        const tw = spanRef.current.offsetWidth

        const targetX = tw > vw ? -(tw - vw) : 0

        if (posRef.current > targetX) {
          const step = (SCROLL_PX_PER_SEC * dt) / 1000
          posRef.current = Math.max(posRef.current - step, targetX)
        }

        innerRef.current.style.transform = `translateX(${posRef.current}px)`
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
    <div ref={viewportRef} style={{ overflow: 'hidden', position: 'relative' }} aria-live="polite">
      <div
        ref={innerRef}
        style={{ display: 'inline-block', whiteSpace: 'nowrap', willChange: 'transform' }}
      >
        <span ref={spanRef} />
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
        <span className="text-indigo-500 text-[10px] font-bold tracking-widest shrink-0">[ LIVE_FEED ]</span>
        <CountdownLabel seconds={timeLeft} />
      </div>
      <div className="ticker-viewport font-mono text-2xl text-indigo-300 uppercase py-0.5 overflow-x-hidden min-w-0">
        {hasContent ? (
          <SmoothTicker text={line} />
        ) : (
          <span className="text-slate-600 opacity-50">{TRANSCRIPT_PLACEHOLDER}</span>
        )}
      </div>
    </div>
  )
}
