import { type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  prefix?: string
}

export function Input({ prefix, disabled, className, ...props }: InputProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 border border-line-2 rounded-[13px] px-[15px] py-[13px] bg-black/25 transition-colors',
        disabled ? 'opacity-50' : 'focus-within:border-acid/50',
      )}
    >
      {prefix && (
        <span className="text-acid text-[15px] font-semibold shrink-0">{prefix}</span>
      )}
      <input
        disabled={disabled}
        className={cn(
          'flex-1 bg-transparent outline-none font-mono text-2xl font-medium text-txt tabular-nums w-full',
          className,
        )}
        {...props}
      />
    </div>
  )
}
