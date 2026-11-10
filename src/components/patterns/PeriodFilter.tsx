import { CalendarRange } from 'lucide-react'
import { PERIOD_LABEL, type PeriodPreset } from '@/lib/period'

/** Seletor compacto de período (Este mês, Mês passado, Últimos 90 dias…). */
export function PeriodFilter({ value, onChange }: { value: PeriodPreset; onChange: (p: PeriodPreset) => void }) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Período</span>
      <CalendarRange size={15} className="absolute left-2.5 text-faint pointer-events-none" aria-hidden />
      <select value={value} onChange={(e) => onChange(e.target.value as PeriodPreset)}
        className="h-8 pl-8 pr-3 rounded-md bg-sunken text-[13px] text-ink outline-none ring-1 ring-transparent focus:ring-accent cursor-pointer">
        {(Object.keys(PERIOD_LABEL) as PeriodPreset[]).map((p) => <option key={p} value={p}>{PERIOD_LABEL[p]}</option>)}
      </select>
    </label>
  )
}
