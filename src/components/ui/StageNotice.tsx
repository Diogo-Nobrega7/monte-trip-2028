import type { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'

/** Aviso discreto de recurso ainda não ativado nesta etapa. */
export function StageNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 items-start rounded-md bg-accent/[0.06] ring-1 ring-inset ring-accent/15 px-4 py-3 text-[13px] leading-relaxed text-muted mb-6">
      <Sparkles size={16} className="text-accent shrink-0 mt-0.5" aria-hidden />
      <p>{children}</p>
    </div>
  )
}
