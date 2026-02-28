export interface LastResultPanelProps {
  message: string
  transcript?: string
}

export default function LastResultPanel({ message, transcript }: LastResultPanelProps) {
  return (
    <div className="mt-6 rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-slate-300">
      <p className="font-medium">{message}</p>
      {transcript && (
        <p className="mt-2 text-sm text-slate-500">
          Transcript: {transcript.slice(0, 200)}
          {transcript.length > 200 ? '…' : ''}
        </p>
      )}
    </div>
  )
}
