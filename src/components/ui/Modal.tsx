import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

// pilha de modais abertos: Esc e Tab só agem no de cima (ex.: estorno aberto sobre a lista de lançamentos)
const stack: object[] = []

/**
 * Modal acessível: role=dialog, foco inicial, Esc fecha, foco volta ao gatilho,
 * Tab preso dentro do diálogo. No celular vira folha que sobe da base.
 */
export function Modal({ open, onClose, title, description, children, footer, wide }: {
  open: boolean; onClose: () => void; title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode
  /** Formulários grandes e tabelas: mais largo no desktop. */
  wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  // guarda o onClose mais recente: o efeito abaixo roda só ao abrir, senão o foco pularia a cada tecla
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    if (!open) return
    const token = {}
    stack.push(token)
    const prev = document.activeElement as HTMLElement | null
    const el = ref.current!
    const focusables = () => [...el.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')].filter((n) => !n.hasAttribute('disabled'))
    ;(focusables()[1] ?? focusables()[0])?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== token) return
      if (e.key === 'Escape') close.current()
      if (e.key === 'Tab') {
        const f = focusables(); if (!f.length) return
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus() }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      stack.splice(stack.indexOf(token), 1)
      document.removeEventListener('keydown', onKey)
      if (!stack.length) document.body.style.overflow = ''
      prev?.focus()
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-6">
      <div className="absolute inset-0 bg-navy/40 backdrop-blur-[3px] animate-[fade-in_.2s_ease-out]" onClick={onClose} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="modal-title"
        className={`relative w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} max-h-[90vh] flex flex-col bg-surface shadow-lg ring-1 ring-line
          rounded-t-xl sm:rounded-xl animate-[slide-up_.28s_cubic-bezier(.2,.7,.2,1)] sm:animate-[pop-in_.22s_cubic-bezier(.2,.7,.2,1)]
          pb-[env(safe-area-inset-bottom,0px)] sm:pb-0`}>
        <header className="flex items-start gap-4 px-6 pt-6 pb-4">
          <div className="flex-1 min-w-0">
            <h2 id="modal-title" className="font-display text-xl font-bold tracking-tight">{title}</h2>
            {description && <div className="text-sm text-muted mt-1">{description}</div>}
          </div>
          <button onClick={onClose} aria-label="Fechar" className="p-1.5 -m-1.5 rounded-md text-faint hover:text-ink hover:bg-sunken">
            <X size={18} />
          </button>
        </header>
        <div className="px-6 pb-6 overflow-y-auto">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 px-6 py-4 border-t border-line bg-raised rounded-b-xl">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
