import { cx } from './cx'

/** Controle segmentado com indicador deslizante. */
export function Segmented({ options, value, onChange, label }: {
  options: string[]; value: string; onChange: (v: string) => void; label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-md bg-sunken p-1 gap-0.5 [scrollbar-width:none]">
      {options.map((o) => (
        <button key={o} role="radio" aria-checked={value === o} onClick={() => onChange(o)}
          className={cx('h-7 px-3 rounded-sm text-[13px] font-medium whitespace-nowrap transition-all duration-150',
            value === o ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}>
          {o}
        </button>
      ))}
    </div>
  )
}
