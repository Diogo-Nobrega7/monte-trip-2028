import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, type LucideIcon } from 'lucide-react'
import { cx } from './cx'

export interface DropdownItem { id: string; label: string; icon?: LucideIcon; selected?: boolean }

/** Menu suspenso com teclado (setas, Esc) e fechamento ao clicar fora. */
export function Dropdown({ trigger, items, onSelect, label, align = 'start', placement = 'bottom' }: {
  trigger: (p: { open: boolean; toggle: () => void; id: string }) => ReactNode
  items: DropdownItem[]; onSelect: (id: string) => void; label: string
  align?: 'start' | 'end'; placement?: 'bottom' | 'top'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const id = useRef(`dd-${Math.random().toString(36).slice(2, 8)}`).current
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => {
      const btns = [...(ref.current?.querySelectorAll<HTMLButtonElement>('[role=menuitemradio]') ?? [])]
      const i = btns.indexOf(document.activeElement as HTMLButtonElement)
      if (e.key === 'Escape') setOpen(false)
      if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length]?.focus() }
      if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length]?.focus() }
    }
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey)
    requestAnimationFrame(() => ref.current?.querySelector<HTMLButtonElement>('[role=menuitemradio]')?.focus())
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o), id })}
      {open && (
        <div id={id} role="menu" aria-label={label}
          className={cx('absolute z-50 min-w-[200px] p-1 rounded-md bg-surface shadow-lg ring-1 ring-line animate-[pop-in_.16s_ease-out]',
            align === 'end' ? 'right-0' : 'left-0', placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2')}>
          {items.map((it) => (
            <button key={it.id} role="menuitemradio" aria-checked={!!it.selected}
              onClick={() => { onSelect(it.id); setOpen(false) }}
              className="w-full flex items-center gap-2.5 h-9 px-2.5 rounded-sm text-sm text-ink hover:bg-sunken focus:bg-sunken outline-none">
              {it.icon && <it.icon size={16} className="text-muted" aria-hidden />}
              <span className="flex-1 text-left">{it.label}</span>
              {it.selected && <Check size={15} className="text-accent" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
