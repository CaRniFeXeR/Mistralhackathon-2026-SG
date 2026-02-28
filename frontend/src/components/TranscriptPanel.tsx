import { Mic } from 'lucide-react'

export interface TranscriptPanelProps {
  title?: string
  emptyHint: string
  transcript: string
}

export function TranscriptPanel({ title = 'Live Transcript', emptyHint, transcript }: TranscriptPanelProps) {
  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 shadow-inner flex flex-col h-[300px]">
      <div className="flex items-center gap-2 mb-4 text-slate-400 text-sm font-bold uppercase tracking-widest border-b border-slate-800 pb-2">
        <Mic className="w-4 h-4" /> {title}
      </div>
      <div className="flex-1 overflow-y-auto text-slate-300 font-medium leading-relaxed">
        {transcript || <span className="text-slate-600 italic">{emptyHint}</span>}
      </div>
    </div>
  )
}

