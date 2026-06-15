import { type InputHTMLAttributes, type ReactNode } from 'react'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string
  onChange: (value: string) => void
  prefix?: ReactNode
  suffix?: ReactNode
  wrapperClassName?: string
}

export function Input({
  value,
  onChange,
  prefix,
  suffix,
  wrapperClassName = '',
  className = '',
  disabled,
  ...rest
}: InputProps) {
  return (
    <div
      className={[
        'flex items-center gap-2 px-3 py-2 rounded-lg border border-line-2 bg-panel-2',
        'focus-within:border-acid/40 transition-colors',
        disabled ? 'opacity-40' : '',
        wrapperClassName,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {prefix != null && (
        <span className="text-txt-faint text-sm font-medium shrink-0">{prefix}</span>
      )}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={['flex-1 bg-transparent text-sm text-txt outline-none', className]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      />
      {suffix != null && (
        <span className="text-txt-faint text-sm font-medium shrink-0">{suffix}</span>
      )}
    </div>
  )
}
