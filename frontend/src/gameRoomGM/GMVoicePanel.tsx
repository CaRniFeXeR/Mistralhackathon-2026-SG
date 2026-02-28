import { Mic } from 'lucide-react'
import LabeledPanel from '../components/LabeledPanel'
import { ASCII_PANEL_CLASS } from './utils'

export interface GMVoicePanelProps {
  currentTranscript: string
}

export default function GMVoicePanel({ currentTranscript }: GMVoicePanelProps) {
  return (
    <LabeledPanel label="[ VOICE ]" panelClassName={ASCII_PANEL_CLASS}>
      <div className="mt-2 flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-2 text-slate-500 text-base border-b border-gray-800 pb-2">
          <Mic className="w-4 h-4 text-red-500 animate-pulse" /> Live transcript
        </div>
        <div className="flex-1 overflow-y-auto font-mono text-base text-green-400 leading-relaxed uppercase pr-2">
          {currentTranscript || (
            <span className="text-slate-600 opacity-50">&gt; Awaiting speech...</span>
          )}
        </div>
      </div>
    </LabeledPanel>
  )
}
