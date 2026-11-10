import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cx } from './cx'

/**
 * Dica acessível: abre no hover e no foco do teclado (aria-describedby).
 * Só existe no DOM quando aberta e se desloca para não sair da tela.
 */
export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [shift, setShift] = useState(0)
  const tip = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    if (!open || !tip.current) return
    const r = tip.current.getBoundingClientRect(), pad = 8
    setShift(r.left < pad ? pad - r.left : r.right > window.innerWidth - pad ? window.innerWidth - pad - r.right : 0)
  }, [open])
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => { setOpen(false); setShift(0) }}
      onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setShift(0) }} aria-describedby={open ? id : undefined}>
      {children}
      {open && (
        <span ref={tip} role="tooltip" id={id} style={{ translate: `calc(-50% + ${shift}px) 0` }}
          className={cx(
            'pointer-events-none absolute left-1/2 z-50 w-max max-w-[240px] rounded-md px-2.5 py-1.5',
            'bg-ink text-bg text-xs leading-snug shadow-md animate-[fade-in_.12s_ease-out]',
            side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
          )}>
          {content}
        </span>
      )}
    </span>
  )
}
