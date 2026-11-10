import type { ReactNode } from 'react'
import { cx } from './cx'

/**
 * Superfície base. `tone="plain"` é uma seção sem moldura (para quebrar a grade de cards).
 */
export function Card({ children, className, tone = 'raised', as: As = 'section' }: {
  children: ReactNode; className?: string; tone?: 'raised' | 'plain' | 'sunken'; as?: 'section' | 'div' | 'article'
}) {
  return (
    <As className={cx(
      tone === 'raised' && 'bg-surface rounded-lg shadow-sm ring-1 ring-line/70',
      tone === 'sunken' && 'bg-sunken/70 rounded-lg',
      className,
    )}>{children}</As>
  )
}

export function CardHeader({ title, hint, action, className }: { title: ReactNode; hint?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <header className={cx('flex items-start justify-between gap-4 px-5 pt-5 pb-4', className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        {hint && <p className="text-[13px] text-muted mt-1">{hint}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}
