import { type ButtonHTMLAttributes } from 'react'
import { cn } from '@/shared/utils/cn'

export type ButtonVariant = 'acid' | 'green' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS: Record<ButtonVariant, string> = {
  acid:   'bg-acid text-bg font-bold tracking-wide',
  green:  'bg-green/15 text-green border border-green/30 font-bold tracking-wide',
  danger: 'bg-red/10 text-red border border-red/25 font-bold tracking-wide',
  ghost:  'border border-line-2 text-txt-dim hover:border-line hover:text-txt font-medium',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'py-1.5 px-3 text-xs rounded-lg',
  md: 'py-2 px-3.5 text-xs rounded-lg',
  lg: 'py-3 px-5 text-sm rounded-lg',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

export function Button({
  variant = 'acid',
  size = 'md',
  fullWidth = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={cn(
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        'transition-opacity',
        disabled ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90 active:opacity-75',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
