import { type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'solid' | 'outline'
  size?: 'sm' | 'lg'
}

export function Button({ variant = 'solid', size = 'lg', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2.5 leading-none font-semibold',
        'cursor-pointer disabled:cursor-not-allowed',
        size === 'sm' && 'px-2 py-1 rounded text-[10px] font-mono uppercase tracking-widest',
        size === 'lg' && 'rounded-[14px] py-[18px] px-5 text-[18px]',
        variant === 'solid' && 'border-0 transition-transform',
        variant === 'outline' && 'border border-line text-txt-faint transition-colors hover:border-line-2 hover:text-txt-dim',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
