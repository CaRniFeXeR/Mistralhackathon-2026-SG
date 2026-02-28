import { type FormEvent, type RefObject } from 'react'

export interface GuessFormProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (e: FormEvent) => void
  disabled: boolean
  placeholder?: string
  inputRef?: RefObject<HTMLInputElement | null>
  submitLabel?: string
  inputClassName?: string
  formClassName?: string
  onFocus?: () => void
  onBlur?: () => void
}

const DEFAULT_PLACEHOLDER = '> ENTER_GUESS...'
const DEFAULT_SUBMIT_LABEL = '< SEND />'

export default function GuessForm({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder = DEFAULT_PLACEHOLDER,
  inputRef,
  submitLabel = DEFAULT_SUBMIT_LABEL,
  inputClassName = 'terminal-input w-full flex-1 min-w-0',
  formClassName,
  onFocus,
  onBlur,
}: GuessFormProps) {
  return (
    <form onSubmit={onSubmit} className={formClassName ?? 'flex w-full items-center gap-2'}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        className={inputClassName}
        disabled={disabled}
        autoComplete="off"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="ascii-btn whitespace-nowrap !py-2 shrink-0"
      >
        {submitLabel}
      </button>
    </form>
  )
}
