import type { ISODate } from '@/types/domain'

/** Filtros de período usados nas listas e relatórios. Datas sempre 'AAAA-MM-DD' (comparáveis como texto). */
export type PeriodPreset = 'tudo' | 'mes' | 'mes_passado' | '90d' | 'ano'
export const PERIOD_LABEL: Record<PeriodPreset, string> = {
  tudo: 'Todo o período', mes: 'Este mês', mes_passado: 'Mês passado', '90d': 'Últimos 90 dias', ano: 'Este ano',
}

export interface Range { from: ISODate | null; to: ISODate | null }

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parse = (s: ISODate) => new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)))

/** Intervalo fechado [from, to] do atalho, relativo a `today`. */
export function presetRange(p: PeriodPreset, today: ISODate): Range {
  const t = parse(today)
  switch (p) {
    case 'tudo': return { from: null, to: null }
    case 'mes': return { from: iso(new Date(t.getFullYear(), t.getMonth(), 1)), to: iso(new Date(t.getFullYear(), t.getMonth() + 1, 0)) }
    case 'mes_passado': return { from: iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), to: iso(new Date(t.getFullYear(), t.getMonth(), 0)) }
    case '90d': return { from: iso(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 89)), to: today }
    case 'ano': return { from: `${t.getFullYear()}-01-01`, to: `${t.getFullYear()}-12-31` }
  }
}

export const inRange = (d: ISODate, r: Range) => (!r.from || d >= r.from) && (!r.to || d <= r.to)

/** "01/03/2027 a 31/03/2027", "até 31/03/2027", "todo o período" */
export function rangeLabel(r: Range): string {
  const br = (s: string) => s.split('-').reverse().join('/')
  if (r.from && r.to) return `${br(r.from)} a ${br(r.to)}`
  if (r.from) return `a partir de ${br(r.from)}`
  if (r.to) return `até ${br(r.to)}`
  return 'todo o período'
}
