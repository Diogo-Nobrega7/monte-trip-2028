import type { ReactNode } from 'react'
import { Info, type LucideIcon } from 'lucide-react'
import { Tooltip } from './Tooltip'
import { cx } from './cx'

/** Indicador numérico. `info` explica a fórmula em uma dica. */
export function Stat({ icon: Icon, label, value, note, info, tone = 'default', className }: {
  icon?: LucideIcon; label: string; value: ReactNode; note?: ReactNode; info?: string
  tone?: 'default' | 'ok' | 'warn' | 'bad'; className?: string
}) {
  const toneCls = { default: 'text-muted bg-sunken', ok: 'text-ok bg-ok/10', warn: 'text-warn bg-warn/10', bad: 'text-bad bg-bad/10' }[tone]
  return (
    <div className={cx('group', className)}>
      <div className="flex items-center gap-2">
        {Icon && <span className={cx('grid place-items-center size-7 rounded-sm', toneCls)}><Icon size={15} strokeWidth={2} aria-hidden /></span>}
        <span className="text-[13px] text-muted">{label}</span>
        {info && (
          <Tooltip content={info}>
            <button type="button" aria-label={`Como é calculado: ${label}`} className="text-faint hover:text-muted"><Info size={13} /></button>
          </Tooltip>
        )}
      </div>
      <div className="num mt-2.5 font-display text-[26px] leading-none font-bold tracking-[-0.02em] text-ink">{value}</div>
      {note && <div className="text-xs text-faint mt-2">{note}</div>}
    </div>
  )
}
