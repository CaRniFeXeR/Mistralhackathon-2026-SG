export interface CountdownLabelProps {
  seconds: number
  className?: string
}

export function CountdownLabel({ seconds, className = '' }: CountdownLabelProps) {
  const isCritical = seconds <= 5
  const display = seconds.toString().padStart(2, '0')
  return (
    <span
      className={`text-[10px] font-bold ${isCritical ? 'text-red-500 animate-pulse' : 'text-slate-500'} ${className}`}
    >
      T-{display}s
    </span>
  )
}
