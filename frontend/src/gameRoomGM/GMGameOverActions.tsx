import { useNavigate } from 'react-router-dom'
import tabooPresets from '../data/tabooPresets.json'
import LabeledField from '../components/LabeledField'
import { ASCII_PANEL_CLASS } from './utils'

type TabooPreset = { target: string; taboo: string[] }
const presets = tabooPresets as TabooPreset[]

export interface GMGameOverActionsProps {
  roomId: string
  newTargetWord: string
  newTabooWordsStr: string
  onNewTargetWordChange: (value: string) => void
  onNewTabooWordsStrChange: (value: string) => void
  onRestart: () => void
}

export default function GMGameOverActions({
  roomId,
  newTargetWord,
  newTabooWordsStr,
  onNewTargetWordChange,
  onNewTabooWordsStrChange,
  onRestart,
}: GMGameOverActionsProps) {
  const navigate = useNavigate()

  const handleRandomize = () => {
    const preset = presets[Math.floor(Math.random() * presets.length)]
    onNewTargetWordChange(preset.target)
    onNewTabooWordsStrChange(preset.taboo.join(', '))
  }

  return (
    <section className={`${ASCII_PANEL_CLASS} p-6 w-full max-w-lg mt-6 bg-black/80 shadow-2xl`}>
      <h3 className="text-xl font-bold text-white mb-4 text-center">++ SEQUENCE_COMPLETE</h3>
      <div className="space-y-4">
        <LabeledField label="[ NEW_TARGET ]">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTargetWord}
              onChange={(e) => onNewTargetWordChange(e.target.value)}
              className="terminal-input flex-grow min-w-0"
            />
            <button
              type="button"
              onClick={handleRandomize}
              className="border border-blue-500 px-3 py-1 text-blue-500 hover:bg-blue-500 hover:text-white transition-colors text-sm shrink-0"
            >
              RANDOM
            </button>
          </div>
        </LabeledField>
        <LabeledField label="[ NEW_RESTRICTIONS (csv) ]">
          <input
            type="text"
            value={newTabooWordsStr}
            onChange={(e) => onNewTabooWordsStrChange(e.target.value)}
            className="terminal-input w-full"
          />
        </LabeledField>
        <button type="button" onClick={onRestart} className="ascii-btn w-full mt-4">
          <span className="block font-bold">New game</span>
          <span className="block text-xs opacity-80 mt-0.5">&lt; RESTART_SEQUENCE /&gt;</span>
        </button>
        <button
          type="button"
          onClick={() => navigate(`/room/${roomId}/history`)}
          className="ascii-btn w-full mt-3"
        >
          See history
        </button>
      </div>
    </section>
  )
}
