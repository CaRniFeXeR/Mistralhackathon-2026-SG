import { useNavigate } from 'react-router-dom'
import LabeledField from '../components/LabeledField'
import { ASCII_PANEL_CLASS } from './utils'

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

  return (
    <section className={`${ASCII_PANEL_CLASS} p-6 w-full max-w-lg mt-6 bg-black/80 shadow-2xl`}>
      <h3 className="text-xl font-bold text-white mb-4 text-center">++ SEQUENCE_COMPLETE</h3>
      <div className="space-y-4">
        <LabeledField label="[ NEW_TARGET ]">
          <input
            type="text"
            value={newTargetWord}
            onChange={(e) => onNewTargetWordChange(e.target.value)}
            className="terminal-input w-full"
          />
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
          &lt; RESTART_SEQUENCE /&gt;
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
