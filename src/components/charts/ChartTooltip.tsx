import { money } from '@/lib/format'

interface Item { dataKey?: string | number; value?: number; color?: string; payload?: Record<string, number> }

/** Tooltip personalizado para Recharts: título, linhas coloridas e total opcional. */
export function ChartTooltip({ active, payload, label, labels, titleFor, totalKey, totalLabel }: {
  active?: boolean; payload?: Item[]; label?: number | string
  labels: Record<string, string>; titleFor: (l: number | string) => string
  totalKey?: string; totalLabel?: string
}) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload ?? {}
  return (
    <div className="min-w-[200px] rounded-md bg-surface/95 backdrop-blur shadow-lg ring-1 ring-line px-3.5 py-3 text-[13px]">
      <p className="text-xs text-faint mb-2">{titleFor(label ?? '')}</p>
      <ul className="space-y-1.5">
        {payload.map((p) => (
          <li key={String(p.dataKey)} className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
            <span className="text-muted flex-1">{labels[String(p.dataKey)]}</span>
            <span className="num font-medium text-ink">{money(p.value ?? 0)}</span>
          </li>
        ))}
      </ul>
      {totalKey && (
        <div className="flex justify-between mt-2.5 pt-2.5 border-t border-line">
          <span className="text-muted">{totalLabel}</span>
          <span className="num font-semibold text-ink">{money(row[totalKey] ?? 0)}</span>
        </div>
      )}
    </div>
  )
}
