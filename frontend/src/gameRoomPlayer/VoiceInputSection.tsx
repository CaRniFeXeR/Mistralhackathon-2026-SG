import { Mic, MicOff } from 'lucide-react'

export interface VoiceInputSectionProps {
  isRecording: boolean
  onToggle: () => void
  voiceTranscript: string
  lastVoiceGuess: string | null
  disabled: boolean
  /** Compact layout for waiting state (smaller button, different transcript block). */
  compact?: boolean
  /** When true, only render the toggle button (for inline use e.g. next to form). */
  buttonOnly?: boolean
  /** When false, hide the button and only show transcript/last guess blocks. */
  showButton?: boolean
}

const SPEAK_PLACEHOLDER = '> SPEAK_CLEARLY...'

export default function VoiceInputSection({
  isRecording,
  onToggle,
  voiceTranscript,
  lastVoiceGuess,
  disabled,
  compact = false,
  buttonOnly = false,
  showButton = true,
}: VoiceInputSectionProps) {
  const showTranscript = !buttonOnly && (isRecording || voiceTranscript)
  const showLastGuess = !buttonOnly && lastVoiceGuess && !isRecording

  if (buttonOnly) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => { void onToggle() }}
        title={isRecording ? 'Stop speaking' : 'Speak your guess'}
        className={`ascii-border border-double transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          compact ? 'p-2' : 'p-3'
        } ${isRecording
          ? 'text-red-500 bg-red-900/30 border-red-500 hover:bg-red-900/50'
          : 'text-emerald-500 hover:bg-emerald-900/30 hover:text-emerald-400'
          }`}
      >
        {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {showButton && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => { void onToggle() }}
          title={isRecording ? 'Stop speaking' : 'Speak your guess'}
          className={`ascii-border border-double w-full flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            compact ? 'p-2' : 'p-3'
          } ${isRecording
            ? 'text-red-500 bg-red-900/30 border-red-500 hover:bg-red-900/50'
            : 'text-emerald-500 hover:bg-emerald-900/30 hover:text-emerald-400'
            }`}
        >
          {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          {!compact && (
            <span className="font-bold text-sm tracking-widest">
              {isRecording ? 'STOP' : 'VOICE INPUT'}
            </span>
          )}
        </button>
      )}
      {showTranscript && (
        <div
          className={
            compact
              ? 'ascii-border border-double p-3 mt-4 text-emerald-400 bg-emerald-900/10'
              : 'ascii-border border-double p-2 text-emerald-400 bg-emerald-900/10 text-xs font-mono uppercase'
          }
        >
          {compact ? (
            <div className="flex flex-col">
              <span className="font-bold text-[10px] tracking-widest mb-1">
                {isRecording ? '[ RECORDING_IN_PROGRESS ]' : '[ PROCESSING_AUDIO ]'}
              </span>
              <span className="font-mono text-sm uppercase">
                {voiceTranscript || <span className="opacity-50">{SPEAK_PLACEHOLDER}</span>}
              </span>
            </div>
          ) : (
            voiceTranscript || <span className="opacity-50">{SPEAK_PLACEHOLDER}</span>
          )}
        </div>
      )}
      {showLastGuess && (
        <div
          className={
            compact
              ? 'flex items-center gap-2 border border-dashed border-gray-700 bg-black px-4 py-2 text-sm text-slate-400 font-mono mt-2'
              : 'flex items-center gap-2 border border-dashed border-gray-700 bg-black px-3 py-2 text-xs text-slate-400 font-mono'
          }
        >
          <Mic className={`shrink-0 text-slate-500 ${compact ? 'w-3.5 h-3.5' : 'w-3 h-3'}`} />
          <span>{compact ? 'LAST_TRANSMISSION:' : 'LAST:'}</span>
          <span className="font-bold text-blue-400 uppercase">{lastVoiceGuess}</span>
        </div>
      )}
    </div>
  )
}
