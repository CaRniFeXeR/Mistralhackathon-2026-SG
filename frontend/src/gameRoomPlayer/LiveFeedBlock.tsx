import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
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

  const scrollOffsetRef = useRef(0)
  const segmentWidthRef = useRef(0)
  const lastTimeRef = useRef(performance.now())
  const rafIdRef = useRef<number | null>(null)
  const contentRef = useRef<HTMLSpanElement | null>(null)
  const measureRef = useRef<HTMLSpanElement | null>(null)

  // Measure content width when line changes and reset scroll so new text starts from the start
  useLayoutEffect(() => {
    if (!hasContent || !measureRef.current) return
    segmentWidthRef.current = measureRef.current.offsetWidth
    scrollOffsetRef.current = 0
  }, [line, hasContent])

  // Scroll once: move content left until it's fully off-screen, then stop (no loop)
  useEffect(() => {
    if (!hasContent || !contentRef.current) return

    function tick(now: number) {
      const segW = segmentWidthRef.current
      if (segW <= 0) {
        rafIdRef.current = requestAnimationFrame(tick)
        return
      }
      const deltaSec = (now - lastTimeRef.current) / 1000
      lastTimeRef.current = now
      scrollOffsetRef.current += TICKER_SPEED_PX_PER_SEC * deltaSec

      const done = scrollOffsetRef.current >= segW
      if (done) {
        scrollOffsetRef.current = segW
        if (rafIdRef.current != null) {
          cancelAnimationFrame(rafIdRef.current)
          rafIdRef.current = null
        }
      }

      if (contentRef.current) {
        contentRef.current.style.transform = `translateX(-${scrollOffsetRef.current}px)`
      }
      if (!done) {
        rafIdRef.current = requestAnimationFrame(tick)
      }
    }

    lastTimeRef.current = performance.now()
    rafIdRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [hasContent, line])

  return (
    <div className="w-full min-w-0 overflow-x-hidden ascii-border border-double p-3 mb-2">
      <div className="flex items-center justify-between gap-2 mb-1.5 min-w-0">
        <span className="text-blue-500 text-[10px] font-bold tracking-widest shrink-0">[ LIVE_FEED ]</span>
        <CountdownLabel seconds={timeLeft} />
      </div>
      <div className="ticker-viewport relative font-mono text-2xl text-green-400 uppercase py-0.5 overflow-x-hidden min-w-0">
        {hasContent ? (
          <>
            <span
              ref={contentRef}
              className="ticker-content-js"
              aria-live="polite"
            >
              {tickerText}
            </span>
            <div className="absolute left-0 top-0 w-0 h-0 overflow-hidden pointer-events-none" aria-hidden>
              <span
                ref={measureRef}
                className="ticker-content-js absolute left-0 top-0 whitespace-nowrap invisible"
              >
                {line}{SEPARATOR}
              </span>
            </div>
          </>
        ) : (
          <span className="text-slate-600 opacity-50">{TRANSCRIPT_PLACEHOLDER}</span>
        )}
      </div>
    </div>
  )
}
