import { Users } from 'lucide-react'

export interface PlayerCountBadgeProps {
  playerCount: number
  playerNumber: number | null
  blink: boolean
}

export default function PlayerCountBadge({ playerCount, playerNumber, blink }: PlayerCountBadgeProps) {
  return (
    <div className="flex justify-center mt-6">
      <span
        className={`inline-flex items-center gap-2 px-3 py-1 font-bold text-blue-400 border border-blue-500/50 bg-blue-900/20 transition-[box-shadow,background-color] duration-300 ${
          blink ? 'player-badge-blink' : ''
        }`}
      >
        <Users className="w-4 h-4" />
        PLAYERS: {playerCount}
        {playerNumber != null && (
          <>
            <span className="text-slate-500">|</span>
            <span>YOU: #{playerNumber}</span>
          </>
        )}
      </span>
    </div>
  )
}
