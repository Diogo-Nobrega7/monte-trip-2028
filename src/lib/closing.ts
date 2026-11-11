import type { Cents, ISODate } from '@/types/domain'
import { situations, delinquency, type InstallmentLike, type PaymentLike } from './installments'
import { summarize, type LedgerEntry, type PeriodSummary } from './ledger'

/** Primeiro e último dia de um mês 'AAAA-MM'. */
export function monthRange(month: string): { from: ISODate; to: ISODate } {
  const y = Number(month.slice(0, 4)), m = Number(month.slice(5, 7))
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}

/** Mês anterior a 'AAAA-MM'. */
export function previousMonth(month: string): string {
  const y = Number(month.slice(0, 4)), m = Number(month.slice(5, 7))
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

export interface MonthClosing extends PeriodSummary {
  month: string
  /** Inadimplência no último dia do mês (só alunos ativos). */
  lateCount: number
  lateAmount: Cents
  lateStudents: number
  /** Despesas do mês, válidas (não estornadas), sem comprovante. */
  noReceiptCount: number
  noReceiptAmount: Cents
  /** Lançamentos do mês ainda sem conferência. */
  uncheckedCount: number
}

/**
 * Fechamento de um mês: saldo inicial/final, entradas e saídas (livro-caixa), inadimplência
 * na virada do mês e pendências de comprovante e conferência. Não inventa nada: só soma o registrado.
 */
export function monthClosing(p: {
  month: string
  ledger: LedgerEntry[]
  installments: InstallmentLike[]
  payments: PaymentLike[]
  activeStudentIds: Set<string>
  expenses: { id: string; date: ISODate; amount: Cents; reversalOf: string | null }[]
  expenseIdsWithReceipt: Set<string>
  checkedKeys: Set<string> // `${origem}:${id}` já conferidos
}): MonthClosing {
  const r = monthRange(p.month)
  const sum = summarize(p.ledger, r)
  // situação das parcelas no último dia do mês, só com o que tinha sido pago até lá
  const paidUntil = p.payments.filter((x) => x.paidAt <= r.to)
  const sits = situations(p.installments.filter((i) => p.activeStudentIds.has(i.studentId) && i.dueDate <= r.to), paidUntil, r.to)
  const late = delinquency(sits.map((s) => ({ studentId: s.studentId, status: s.status, remaining: s.remaining })))
  const reversed = new Set(p.expenses.flatMap((e) => (e.reversalOf ? [e.reversalOf] : [])))
  const noReceipt = p.expenses.filter((e) => e.date >= r.from && e.date <= r.to && !e.reversalOf && !reversed.has(e.id) && !p.expenseIdsWithReceipt.has(e.id))
  const unchecked = p.ledger.filter((e) => e.date >= r.from && e.date <= r.to && !p.checkedKeys.has(`${e.origin}:${e.id}`))
  return {
    ...sum, month: p.month,
    lateCount: late.lateCount, lateAmount: late.lateAmount, lateStudents: late.lateStudents,
    noReceiptCount: noReceipt.length, noReceiptAmount: noReceipt.reduce((s, e) => s + e.amount, 0),
    uncheckedCount: unchecked.length,
  }
}

/** Compara o saldo do extrato com o saldo registrado no livro-caixa até a mesma data. */
export function reconcile(ledger: LedgerEntry[], bank: { date: ISODate; amount: Cents } | null) {
  if (!bank) return null
  const registered = ledger.filter((e) => e.date <= bank.date).reduce((s, e) => s + e.amount, 0)
  return { date: bank.date, bank: bank.amount, registered, difference: bank.amount - registered }
}
