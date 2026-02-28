import { Mic } from 'lucide-react'

export interface TargetAcquisitionPanelProps {
  transcript: string
}

const TRANSCRIPT_PLACEHOLDER = '> AWAITING_GM...'

export default function TargetAcquisitionPanel({ transcript }: TargetAcquisitionPanelProps) {
  return (
    <div className="ascii-border border-double p-4 relative flex flex-col h-[350px]">
      <div className="absolute -top-3 left-4 bg-black px-2 text-blue-500 text-sm font-bold tracking-widest">
        [ TARGET_ACQUISITION ]
      </div>
      <div className="text-center mt-4">
        <h2 className="text-4xl font-black mb-2 tracking-widest">
          <span className="text-slate-600">???</span>
        </h2>
        <p className="text-slate-500 text-sm mb-4">&gt; AWAITING_START_SIGNAL...</p>
      </div>
      <div className="mt-auto border-t border-dashed border-gray-800 pt-4 flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-2 text-slate-500 text-xs border-b border-gray-800 pb-2">
          <Mic className="w-3 h-3 text-red-500 animate-pulse" /> LIVE_AUDIO_FEED
        </div>
        <div className="flex-1 overflow-y-auto font-mono text-sm text-green-400 leading-relaxed uppercase pr-2">
          {transcript || <span className="text-slate-600 opacity-50">{TRANSCRIPT_PLACEHOLDER}</span>}
        </div>
      </div>
    </div>
  )
}
