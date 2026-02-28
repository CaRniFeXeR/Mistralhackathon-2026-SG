export interface ActionOptionButtonProps {
  isActive: boolean
  title: string
  subtitle: string
  badgeLabel: string
  onClick: () => void
}

export default function ActionOptionButton({
  isActive,
  title,
  subtitle,
  badgeLabel,
  onClick,
}: ActionOptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-4 py-3 text-left text-sm transition focus:outline-none ${isActive
          ? 'border-blue-500 bg-blue-900/20 text-white'
          : 'border-slate-800 bg-black text-slate-400 hover:border-slate-600'
        }`}
    >
      <span className="block text-xs uppercase tracking-widest">{badgeLabel}</span>
      <span className={`mt-1 block text-lg font-bold ${isActive ? 'text-blue-400' : 'text-slate-300'}`}>{title}</span>
      <span className="mt-1 block text-xs">{subtitle}</span>
    </button>
  )
}
