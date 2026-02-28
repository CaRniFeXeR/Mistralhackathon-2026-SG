import { DEFAULT_TARGET } from '../constants/landing'

export interface CreateRoomSectionProps {
  targetWord: string
  tabooWords: string[]
  creatorName: string
  onTargetChange: (value: string) => void
  onTabooChange: (value: string) => void
  onCreatorChange: (value: string) => void
  onRandomize: () => void
}

export default function CreateRoomSection({
  targetWord,
  tabooWords,
  creatorName,
  onTargetChange,
  onTabooChange,
  onCreatorChange,
  onRandomize,
}: CreateRoomSectionProps) {
  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-400">Target word</label>
          <input
            type="text"
            value={targetWord}
            onChange={(e) => onTargetChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder={DEFAULT_TARGET}
          />
        </div>
        <button
          type="button"
          onClick={onRandomize}
          className="shrink-0 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900"
        >
          Randomize
        </button>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-400">Taboo words (comma-separated)</label>
        <input
          type="text"
          value={tabooWords.join(', ')}
          onChange={(e) => onTabooChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="animal, trunk, ivory"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-400">Your name</label>
        <input
          type="text"
          value={creatorName}
          onChange={(e) => onCreatorChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="Game Master"
        />
      </div>
    </div>
  )
}
