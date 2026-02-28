import { useEffect, useMemo, useRef } from 'react'
import { CountdownLabel } from './CountdownLabel'

export interface LiveFeedBlockProps {
  timeLeft: number
  transcript: string
}

const TRANSCRIPT_PLACEHOLDER = '> LISTENING...'
const TICKER_SPEED_PX_PER_SEC = 40
const REPEAT_COPIES = 5
const SEPARATOR = '  ·  '

/** Normalize to one line for ticker. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Build repeated stream: segment + sep + segment + sep + ... (REPEAT_COPIES times) so it loops. */
function repeatedStream(segment: string): string {
  if (!segment) return ''
  const one = segment + SEPARATOR
  return one.repeat(REPEAT_COPIES)
}

export default function LiveFeedBlock({ timeLeft, transcript }: LiveFeedBlockProps) {
  const line = oneLine(transcript)
  const hasContent = line.length > 0
  const tickerText = useMemo(() => repeatedStream(line), [line])

  const scrollOffsetRef = useRef(0)
  const segmentWidthRef = useRef(0)
  const lastTimeRef = useRef(performance.now())
  const rafIdRef = useRef<number | null>(null)
  const contentRef = useRef<HTMLSpanElement | null>(null)
  const measureRef = useRef<HTMLSpanElement | null>(null)

  // Measure one segment (segment + separator) width when line changes
  useEffect(() => {
    if (!hasContent || !measureRef.current) return
    segmentWidthRef.current = measureRef.current.offsetWidth
  }, [line, hasContent])

  // Fixed-pace scroll loop when we have content
  useEffect(() => {
    if (!hasContent || !contentRef.current) return

    function tick(now: number) {
      const deltaSec = (now - lastTimeRef.current) / 1000
      lastTimeRef.current = now
      scrollOffsetRef.current += TICKER_SPEED_PX_PER_SEC * deltaSec

      const segW = segmentWidthRef.current
      while (segW > 0 && scrollOffsetRef.current >= segW) {
        scrollOffsetRef.current -= segW
      }

      if (contentRef.current) {
        contentRef.current.style.transform = `translateX(-${scrollOffsetRef.current}px)`
      }
      rafIdRef.current = requestAnimationFrame(tick)
    }

    lastTimeRef.current = performance.now()
    rafIdRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [hasContent])

  return (
    <div className="shrink-0 min-w-0 ascii-border border-double p-3 mb-2">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-blue-500 text-[10px] font-bold tracking-widest">[ LIVE_FEED ]</span>
        <CountdownLabel seconds={timeLeft} />
      </div>
      <div className="ticker-viewport relative font-mono text-xs text-green-400 uppercase py-0.5">
        {hasContent ? (
          <>
            <span
              ref={contentRef}
              className="ticker-content-js"
              aria-live="polite"
            >
              {tickerText}
            </span>
            <span
              ref={measureRef}
              className="ticker-content-js absolute -left-[9999px] invisible pointer-events-none"
              aria-hidden
            >
              {line}{SEPARATOR}
            </span>
          </>
        ) : (
          <span className="text-slate-600 opacity-50">{TRANSCRIPT_PLACEHOLDER}</span>
        )}
      </div>
    </div>
  )
}
