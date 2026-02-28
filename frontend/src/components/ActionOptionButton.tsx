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
      className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
        isActive
          ? 'border-indigo-500 bg-indigo-600/20 text-indigo-100'
          : 'border-slate-700 bg-slate-800/60 text-slate-200 hover:border-slate-500 hover:bg-slate-800'
      }`}
    >
      <span className="block text-xs font-semibold uppercase tracking-widest text-slate-400">{badgeLabel}</span>
      <span className="mt-1 block text-base text-white">{title}</span>
      <span className="mt-1 block text-xs text-slate-400">{subtitle}</span>
    </button>
  )
}
