import type { GuessEntry } from './types'
import { CountdownLabel } from './CountdownLabel'
import GuessListPanel from './GuessListPanel'

export interface AnalysisTerminalPanelProps {
  timeLeft: number
  humanGuesses: GuessEntry[]
  aiGuesses: GuessEntry[]
  isThinking: boolean
}

export default function AnalysisTerminalPanel({
  timeLeft,
  humanGuesses,
  aiGuesses,
  isThinking,
}: AnalysisTerminalPanelProps) {
  return (
    <div className="ascii-border border-double p-4 relative flex flex-col h-[350px]">
      <div className="absolute -top-3 left-4 bg-black px-2 text-blue-500 text-sm font-bold tracking-widest">
        [ ANALYSIS_TERMINAL ]
      </div>
      <div className="mt-2 flex items-center justify-between border-b border-gray-800 pb-2 mb-2 shrink-0">
        <div className="flex items-center gap-2 text-blue-400 font-bold">
          <CountdownLabel seconds={timeLeft} />
        </div>
      </div>
      <div className="flex-1 flex min-h-0">
        <GuessListPanel
          title="HUMAN_GUESSES"
          guesses={humanGuesses}
          isThinking={isThinking}
          bordered={false}
          titleClassName="text-amber-500"
        />
        <GuessListPanel
          title="AI_INFERENCE"
          guesses={aiGuesses}
          isThinking={isThinking}
          bordered={false}
          titleClassName="text-indigo-400"
        />
      </div>
    </div>
  )
}
