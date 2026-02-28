export interface ErrorAlertProps {
  message: string
}

export default function ErrorAlert({ message }: ErrorAlertProps) {
  return (
    <div className="mt-4 rounded-lg border border-red-500/40 bg-red-900/40 px-4 py-3 text-sm text-red-100">
      {message}
    </div>
  )
}
