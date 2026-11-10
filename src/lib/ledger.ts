import type { Cents, ISODate } from '@/types/domain'
import { inRange, type Range } from './period'

/** Uma linha do livro-caixa (visão livro_caixa no banco). `amount` com sinal: + entra, − sai. */
export type LedgerOrigin = 'mensalidade' | 'arrecadacao' | 'custo_arrecadacao' | 'despesa' | 'rendimento'
export interface LedgerEntry { origin: LedgerOrigin; id: string; date: ISODate; amount: Cents; reversal: boolean; description: string | null }

export const ORIGIN_LABEL: Record<LedgerOrigin, string> = {
  mensalidade: 'Mensalidade', arrecadacao: 'Arrecadação', custo_arrecadacao: 'Custo de ação', despesa: 'Despesa', rendimento: 'Rendimento',
}

export interface PeriodSummary {
  opening: Cents
  tuition: Cents
  fundraisingNet: Cents
  yields: Cents
  expenses: Cents
  inflow: Cents
  outflow: Cents
  closing: Cents
}

/**
 * Prestação de contas de um período: saldo inicial (tudo antes do período), entradas e saídas
 * por tipo, e saldo final. Estornos já vêm com sinal trocado e se compensam sozinhos.
 */
export function summarize(entries: LedgerEntry[], r: Range): PeriodSummary {
  const s: PeriodSummary = { opening: 0, tuition: 0, fundraisingNet: 0, yields: 0, expenses: 0, inflow: 0, outflow: 0, closing: 0 }
  for (const e of entries) {
    if (r.from && e.date < r.from) { s.opening += e.amount; continue }
    if (!inRange(e.date, r)) continue
    if (e.origin === 'mensalidade') s.tuition += e.amount
    else if (e.origin === 'arrecadacao' || e.origin === 'custo_arrecadacao') s.fundraisingNet += e.amount
    else if (e.origin === 'rendimento') s.yields += e.amount
    else s.expenses -= e.amount
  }
  s.inflow = s.tuition + s.fundraisingNet + s.yields
  s.outflow = s.expenses
  s.closing = s.opening + s.inflow - s.outflow
  return s
}

/** Entradas e saídas por mês ('AAAA-MM') e saldo acumulado, para gráfico. Meses sem movimento entram com zero. */
export function monthlySeries(entries: LedgerEntry[]): { month: string; inflow: Cents; outflow: Cents; balance: Cents }[] {
  if (!entries.length) return []
  const by = new Map<string, { inflow: number; outflow: number }>()
  for (const e of entries) {
    const m = e.date.slice(0, 7)
    const v = by.get(m) ?? { inflow: 0, outflow: 0 }
    if (e.origin === 'despesa' || e.origin === 'custo_arrecadacao') v.outflow -= e.amount
    else v.inflow += e.amount
    by.set(m, v)
  }
  const months = [...by.keys()].sort()
  const out: { month: string; inflow: number; outflow: number; balance: number }[] = []
  let [y, mo] = months[0].split('-').map(Number)
  let bal = 0
  const last = months.at(-1)!
  for (;;) {
    const key = `${y}-${String(mo).padStart(2, '0')}`
    const v = by.get(key) ?? { inflow: 0, outflow: 0 }
    bal += v.inflow - v.outflow
    out.push({ month: key, ...v, balance: bal })
    if (key === last) break
    mo++; if (mo > 12) { mo = 1; y++ }
  }
  return out
}

/** Saldo após cada lançamento, em ordem de data (para o histórico de movimentações). */
export function withRunningBalance<E extends LedgerEntry>(entries: E[]): (E & { balance: Cents })[] {
  let bal = 0
  return [...entries]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .map((e) => ({ ...e, balance: (bal += e.amount) }))
}
