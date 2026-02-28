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

export default function LiveFeedBlockDemoPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-6">
      <h1 className="text-xl font-bold mb-2 text-slate-100">LiveFeedBlock demo</h1>
      <p className="text-sm text-slate-400 mb-6">
        Example states with different <code className="text-slate-300">timeLeft</code> and{' '}
        <code className="text-slate-300">transcript</code> values.
      </p>
      <div className="space-y-6 max-w-2xl">
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
