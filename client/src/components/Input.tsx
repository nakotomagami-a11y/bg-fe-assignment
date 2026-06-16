import { type ReactNode } from 'react'
import { cn } from '@/shared/utils/cn'

interface InputProps {
  value: string
  onChange: (value: string) => void
  prefix?: ReactNode
  suffix?: ReactNode
  wrapperClassName?: string
  className?: string
  disabled?: boolean
  placeholder?: string
  inputMode?: 'decimal' | 'numeric' | 'text' | 'search' | 'email' | 'tel' | 'url' | 'none'
}

export function Input({
  value,
  onChange,
  prefix,
  suffix,
  wrapperClassName,
  className,
  disabled,
  placeholder,
  inputMode,
}: InputProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border border-line-2 bg-panel-2',
        'focus-within:border-acid/40 transition-colors',
        disabled && 'opacity-40',
        wrapperClassName,
      )}
    >
      {prefix != null && (
        <span className="text-txt-faint text-sm font-medium shrink-0">{prefix}</span>
      )}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        inputMode={inputMode}
        className={cn('flex-1 bg-transparent text-sm text-txt outline-none', className)}
      />
      {suffix != null && (
        <span className="text-txt-faint text-sm font-medium shrink-0">{suffix}</span>
      )}
    </div>
  )
}
