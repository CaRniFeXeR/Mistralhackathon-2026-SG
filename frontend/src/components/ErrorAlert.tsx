import type { ReactNode } from 'react'

export interface ErrorAlertProps {
  message: string
  icon?: ReactNode
  className?: string
}

export default function ErrorAlert({ message, icon, className }: ErrorAlertProps) {
  const baseClass = 'rounded-lg border border-red-500/40 bg-red-900/40 px-4 py-3 text-sm text-red-100'
  const wrapperClass = className ?? 'mt-4 ' + baseClass
  return (
    <div className={wrapperClass + (icon != null ? ' flex gap-2 items-center' : '')}>
      {icon}
      {icon != null ? <span>{message}</span> : message}
    </div>
  )
}
