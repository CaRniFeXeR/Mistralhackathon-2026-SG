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
  onTargetChange,
  onTabooChange,
  onRandomize,
}: CreateRoomSectionProps) {
  return (
    <section className="ascii-border border-double w-full px-2 mt-8">
      <div className="space-y-3">
        <div className="input-group">
          <label className="block mb-1 text-lg text-red-500">[ TARGET_WORD ]</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={targetWord}
              onChange={(e) => onTargetChange(e.target.value)}
              className="terminal-input flex-grow"
              placeholder={DEFAULT_TARGET}
            />
            <button
              type="button"
              onClick={onRandomize}
              className="border border-blue-500 px-3 py-1 text-blue-500 hover:bg-blue-500 hover:text-white transition-colors text-sm shrink-0"
            >
              RANDOM
            </button>
          </div>
        </div>
        <div>
          <label className="block mb-1 text-lg text-blue-500">[ TABOO_WORDS  ]</label>
          <input
            type="text"
            value={tabooWords.join(', ')}
            onChange={(e) => onTabooChange(e.target.value)}
            className="terminal-input"
            placeholder="E.G. ANIMAL, TRUNK, IVORY, AFRICA, BIG"
          />
        </div>
      </div>
    </section>
  )
}
