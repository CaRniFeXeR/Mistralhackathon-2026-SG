import { ASCII_PANEL_CLASS } from './utils'

export interface GMDesktopTargetBlockProps {
  localTargetWord: string
  localTabooWords: string[]
}

export default function GMDesktopTargetBlock({
  localTargetWord,
  localTabooWords,
}: GMDesktopTargetBlockProps) {
  return (
    <section className={`${ASCII_PANEL_CLASS} p-6 mb-4 text-center`}>
      <p className="text-2xl font-semibold text-slate-300 mb-2">Please describe the word</p>
      <h2 className="text-6xl font-black text-amber-400 mb-3 tracking-widest break-all uppercase">
        {localTargetWord}
      </h2>
      <p className="text-2xl font-semibold text-slate-300 mb-4">without mentioning it.</p>

      {localTabooWords.length > 0 && (
        <div className="mt-4 border-t border-dashed border-gray-800 pt-4">
          <p className="text-2xl font-bold text-slate-300 mb-3">The forbidden words are:</p>
          <div className="flex flex-wrap justify-center gap-3">
            {localTabooWords.map((word, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 bg-red-900/30 text-red-400 text-2xl font-bold border border-red-500/50 uppercase"
              >
                {word}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
