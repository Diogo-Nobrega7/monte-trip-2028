import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

/** Estado vazio: diz o que vai aparecer e como começar. */
export function EmptyState({ icon: Icon, title, children, action }: {
  icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-14">
      <div className="relative mb-5">
        <div className="absolute inset-0 -m-3 rounded-full bg-accent/[0.06]" aria-hidden />
        <div className="relative grid place-items-center size-12 rounded-md bg-surface shadow-md ring-1 ring-line text-accent">
          <Icon size={20} aria-hidden />
        </div>
      </div>
      <p className="font-semibold text-ink">{title}</p>
      {children && <p className="text-sm leading-relaxed text-muted mt-1.5 max-w-sm">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
