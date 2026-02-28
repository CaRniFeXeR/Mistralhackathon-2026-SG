import { ChevronDown, Share2, User, Users } from 'lucide-react'
import { ASCII_PANEL_CLASS } from './utils'

export interface GMPlayingHeaderProps {
  localTargetWord: string
  localTabooWords: string[]
  humanPlayers: { name: string }[]
  playersPopoverOpen: boolean
  shareFeedback: 'copied' | null
  onPlayersPopoverToggle: () => void
  onPlayersPopoverClose: () => void
  onShare: () => void
}

export default function GMPlayingHeader({
  localTargetWord,
  localTabooWords,
  humanPlayers,
  playersPopoverOpen,
  shareFeedback,
  onPlayersPopoverToggle,
  onPlayersPopoverClose,
  onShare,
}: GMPlayingHeaderProps) {
  return (
    <section className={`${ASCII_PANEL_CLASS} p-6 mb-6 relative text-center mt-6`}>
      <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
        <div className="relative inline-block">
          <button
            type="button"
            onClick={onPlayersPopoverToggle}
            className="inline-flex items-center gap-2 px-4 py-2 text-lg font-bold text-blue-400 border border-blue-500/50 bg-blue-900/20 hover:bg-blue-800/30 transition-colors"
          >
            <Users className="w-5 h-5" />
            <span>PLAYERS: {humanPlayers.length}</span>
            <ChevronDown className={`w-5 h-5 transition-transform ${playersPopoverOpen ? 'rotate-180' : ''}`} />
          </button>
          {playersPopoverOpen && (
            <>
              <div className="fixed inset-0 z-10" aria-hidden onClick={onPlayersPopoverClose} />
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 min-w-[220px] py-2 bg-black border border-blue-500 shadow-xl">
                {humanPlayers.length === 0 ? (
                  <p className="px-4 py-2 text-slate-500 text-xl">No players yet</p>
                ) : (
                  <ul className="text-left text-blue-300">
                    {humanPlayers.map((p, i) => (
                      <li key={i} className="flex items-center gap-2 px-4 py-2 hover:bg-blue-900/30 font-mono text-xl">
                        <User className="w-5 h-5 text-blue-500" />
                        {p.name || 'Unknown'}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onShare}
          className="inline-flex items-center gap-2 px-4 py-2 text-lg font-bold text-emerald-400 border border-emerald-500/50 bg-emerald-900/20 hover:bg-emerald-800/30 transition-colors"
          title="Share room link"
        >
          <Share2 className="w-5 h-5" />
          <span>{shareFeedback === 'copied' ? 'LINK COPIED' : 'SHARE LINK'}</span>
        </button>
      </div>

      <p className="text-2xl font-semibold text-slate-300 mb-2">Please describe the word</p>
      <h2 className="text-6xl font-black text-white mb-3 tracking-widest break-all uppercase">
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
