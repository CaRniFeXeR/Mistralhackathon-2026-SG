import { Clock } from 'lucide-react'

export interface TimerBadgeProps {
  seconds: number
}

export function TimerBadge({ seconds }: TimerBadgeProps) {
  const isCritical = seconds <= 5
  const display = seconds.toString().padStart(2, '0')

  return (
    <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700">
      <Clock className={`w-4 h-4 ${isCritical ? 'text-red-400 animate-bounce' : 'text-slate-400'}`} />
      <span className={`font-mono text-lg font-bold ${isCritical ? 'text-red-400' : 'text-slate-200'}`}>
        0:{display}
      </span>
    </div>
  )
}

