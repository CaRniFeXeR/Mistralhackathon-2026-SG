import { useCallback, useEffect, useRef, useState } from 'react'
import LiveFeedBlock from '../gameRoomPlayer/LiveFeedBlock'

const EXAMPLES = [
  { label: 'Empty (placeholder)', timeLeft: 30, transcript: '' },
  { label: 'Short text', timeLeft: 25, transcript: 'The quick brown fox' },
  {
    label: 'Long scrolling text',
    timeLeft: 15,
    transcript:
      'This is a longer example transcript that will scroll in the ticker. It simulates live speech-to-text output during a game round. The text repeats seamlessly for the scrolling effect.',
  },
  {
    label: 'Multi-line normalized',
    timeLeft: 8,
    transcript: `  Line one
  Line two
  Line three  `,
  },
]

const LIVE_WORDS = [
  'the', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog', 'hello', 'world',
  'listening', 'speech', 'text', 'live', 'feed', 'game', 'round', 'player', 'guess',
  'word', 'phrase', 'clue', 'timer', 'score', 'next', 'ready', 'start', 'stop',
]

function randomMsBetween(minSec: number, maxSec: number): number {
  const min = minSec * 1000
  const max = maxSec * 1000
  return min + Math.random() * (max - min)
}

export default function LiveFeedBlockDemoPage() {
  const [liveTranscript, setLiveTranscript] = useState('')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleNextWord = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      const word = LIVE_WORDS[Math.floor(Math.random() * LIVE_WORDS.length)]
      setLiveTranscript((prev) => (prev ? `${prev} ${word}` : word))
      timeoutRef.current = null
      scheduleNextWord()
    }, randomMsBetween(1, 15))
  }, [])

  useEffect(() => {
    scheduleNextWord()
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [scheduleNextWord])

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-6">
      <h1 className="text-xl font-bold mb-2 text-slate-100">LiveFeedBlock demo</h1>
      <p className="text-sm text-slate-400 mb-6">
        Example states with different <code className="text-slate-300">timeLeft</code> and{' '}
        <code className="text-slate-300">transcript</code> values. The first block adds words every 1–15s.
      </p>
      <div className="space-y-6 max-w-2xl">
        <div>
          <p className="text-xs text-slate-500 mb-1">Live (words added every 1–15s)</p>
          <LiveFeedBlock timeLeft={60} transcript={liveTranscript} />
        </div>
        {EXAMPLES.map((ex, i) => (
          <div key={i}>
            <p className="text-xs text-slate-500 mb-1">{ex.label}</p>
            <LiveFeedBlock timeLeft={ex.timeLeft} transcript={ex.transcript} />
          </div>
        ))}
      </div>
    </div>
  )
}
