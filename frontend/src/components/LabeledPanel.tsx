interface LabeledPanelProps {
  label: string
  children: React.ReactNode
  className?: string
  panelClassName?: string
}

export default function LabeledPanel({
  label,
  children,
  className = '',
  panelClassName = 'ascii-border border-double',
}: LabeledPanelProps) {
  return (
    <div className={`${panelClassName} p-4 relative flex flex-col h-[180px] ${className}`}>
      <div className="absolute -top-3 left-4 bg-black px-2 text-blue-500 text-lg font-bold tracking-widest">
        {label}
      </div>
      {children}
    </div>
  )
}
