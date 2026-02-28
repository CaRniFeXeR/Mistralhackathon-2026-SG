interface LabeledFieldProps {
  label: string
  children: React.ReactNode
}

export default function LabeledField({ label, children }: LabeledFieldProps) {
  return (
    <div>
      <label className="block text-sm text-blue-400 mb-1">{label}</label>
      {children}
    </div>
  )
}
