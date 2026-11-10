import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2, type LucideIcon } from 'lucide-react'
import { cx } from './cx'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'gold'
type Size = 'sm' | 'md'
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: Size
  icon?: LucideIcon
  iconRight?: LucideIcon
  loading?: boolean
  children?: ReactNode
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink shadow-[0_1px_0_rgb(255_255_255/.18)_inset,0_1px_2px_rgb(var(--accent)/.4)] hover:brightness-110',
  secondary: 'bg-surface text-ink shadow-sm ring-1 ring-line hover:bg-raised hover:ring-faint/40',
  ghost: 'text-muted hover:text-ink hover:bg-sunken',
  gold: 'bg-gold text-gold-ink hover:brightness-105',
}
const sizes: Record<Size, string> = { sm: 'h-8 px-3 text-[13px] gap-1.5', md: 'h-10 px-4 text-sm gap-2' }

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, iconRight: IconR, loading, children, className, disabled, ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap select-none',
        'transition-[background-color,box-shadow,filter,transform,color] duration-150 ease-out active:scale-[.98]',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        variants[variant], sizes[size], className,
      )}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : Icon && <Icon size={16} strokeWidth={2} aria-hidden />}
      {children}
      {IconR && <IconR size={16} strokeWidth={2} aria-hidden />}
    </button>
  )
})
