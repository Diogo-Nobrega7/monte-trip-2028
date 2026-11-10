import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export function PageHeader({ icon: Icon, section, title, description, actions }: {
  icon?: LucideIcon; section?: string; title: string; description?: string; actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between mb-8">
      <div className="max-w-2xl">
        {section && (
          <p className="flex items-center gap-2 text-[13px] text-muted mb-3">
            {Icon && <Icon size={15} className="text-accent" aria-hidden />}{section}
          </p>
        )}
        <h1 className="font-display text-[30px] sm:text-[34px] leading-[1.1] font-bold tracking-[-0.025em] text-ink">{title}</h1>
        {description && <p className="text-[15px] leading-relaxed text-muted mt-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
