import type { Cents, ISODate } from '@/types/domain'

/**
 * Situação das parcelas. Mesmas regras de situacao_parcela() no banco
 * (supabase/migrations/0003_mensalidades.sql); os cenários de teste são os mesmos nos dois lados.
 *
 *   pago no prazo = pagamentos válidos com data <= vencimento
 *   adicional     = se a referência passou do vencimento e faltou dinheiro no prazo:
 *                   arredonda((valor − pago no prazo) × adicional_bp / 10000), cobrado uma vez
 *   devido        = valor + adicional
 *   paga > atrasada > parcial > pendente
 *
 * "Pagamento válido" = positivo e não estornado. Pagamento parcial nunca quita a parcela.
 */

export type InstallmentStatus = 'paga' | 'pendente' | 'parcial' | 'atrasada'

export interface InstallmentLike {
  id: string
  studentId: string
  number: number
  dueDate: ISODate
  amount: Cents
  penaltyBp: number
}

export interface PaymentLike {
  id: string
  amount: Cents
  paidAt: ISODate
  reversalOf: string | null
  installmentId: string | null
}

export interface Situation {
  amount: Cents
  penalty: Cents
  due: Cents
  paid: Cents
  remaining: Cents
  status: InstallmentStatus
}

/** Adicional por atraso sobre o que faltou, arredondado ao centavo (meio centavo para cima). Só inteiros. */
export function penaltyFor(shortfall: Cents, bp: number): Cents {
  if (shortfall <= 0 || bp <= 0) return 0
  return Math.floor((shortfall * bp + 5_000) / 10_000)
}

/** Pagamentos positivos que não foram estornados. */
export function validPayments<P extends PaymentLike>(payments: P[]): P[] {
  const reversed = new Set(payments.flatMap((p) => (p.reversalOf ? [p.reversalOf] : [])))
  return payments.filter((p) => !p.reversalOf && p.amount > 0 && !reversed.has(p.id))
}

/** Situação de uma parcela na data de referência, a partir dos pagamentos válidos DELA. */
export function situation(inst: InstallmentLike, valid: PaymentLike[], ref: ISODate): Situation {
  let onTime = 0
  let paid = 0
  for (const p of valid) {
    if (p.installmentId !== inst.id) continue
    paid += p.amount
    if (p.paidAt <= inst.dueDate) onTime += p.amount
  }
  const late = ref > inst.dueDate
  const penalty = late && onTime < inst.amount ? penaltyFor(inst.amount - onTime, inst.penaltyBp) : 0
  const due = inst.amount + penalty
  const status: InstallmentStatus = paid >= due ? 'paga' : late ? 'atrasada' : paid > 0 ? 'parcial' : 'pendente'
  return { amount: inst.amount, penalty, due, paid, remaining: Math.max(0, due - paid), status }
}

/** Situação de todas as parcelas de uma vez. */
export function situations<I extends InstallmentLike>(installments: I[], payments: PaymentLike[], ref: ISODate) {
  const valid = validPayments(payments)
  const byInst = new Map<string, PaymentLike[]>()
  for (const p of valid) if (p.installmentId) byInst.set(p.installmentId, [...(byInst.get(p.installmentId) ?? []), p])
  return installments.map((i) => ({ ...i, ...situation(i, byInst.get(i.id) ?? [], ref) }))
}

/**
 * Quanto ainda cabe numa parcela se o pagamento for feito em `paidAt` (com hoje = `today`).
 * Pagando no prazo, não há adicional; depois do vencimento, o adicional entra.
 */
export function maxPayment(inst: InstallmentLike, payments: PaymentLike[], paidAt: ISODate, today: ISODate): Cents {
  const valid = validPayments(payments).filter((p) => p.installmentId === inst.id)
  if (paidAt <= inst.dueDate) {
    // pagando no prazo, o que falta para quitar sem adicional
    const paid = valid.reduce((s, p) => s + p.amount, 0)
    return Math.max(0, inst.amount - paid)
  }
  const ref = paidAt > today ? paidAt : today
  return situation(inst, valid, ref).remaining
}

/** Divide um valor entre parcelas em aberto, da mais antiga para a mais nova (prévia do que o banco fará). */
export function distribute<I extends InstallmentLike>(
  amount: Cents, installments: I[], payments: PaymentLike[], paidAt: ISODate, today: ISODate,
): { parts: { installment: I; amount: Cents }[]; leftover: Cents } {
  let rest = amount
  const parts: { installment: I; amount: Cents }[] = []
  const sorted = [...installments].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.number - b.number)
  for (const inst of sorted) {
    if (rest <= 0) break
    const room = maxPayment(inst, payments, paidAt, today)
    if (room <= 0) continue
    const part = Math.min(rest, room)
    parts.push({ installment: inst, amount: part })
    rest -= part
  }
  return { parts, leftover: rest }
}

/** Indicadores de inadimplência. Alunos desistentes ficam de fora (passe só parcelas de ativos). */
export function delinquency(rows: { studentId: string; status: InstallmentStatus; remaining: Cents }[]) {
  const late = rows.filter((r) => r.status === 'atrasada')
  const open = rows.filter((r) => r.status !== 'paga')
  return {
    lateCount: late.length,
    lateAmount: late.reduce((s, r) => s + r.remaining, 0),
    lateStudents: new Set(late.map((r) => r.studentId)).size,
    openAmount: open.reduce((s, r) => s + r.remaining, 0),
    paidCount: rows.length - open.length,
  }
}

/** Datas de vencimento: dia `dueDay` de cada mês a partir de `startMonth` ('AAAA-MM'). */
export function dueDates(startMonth: string, months: number, dueDay: number): ISODate[] {
  const y0 = Number(startMonth.slice(0, 4))
  const m0 = Number(startMonth.slice(5, 7)) - 1
  return Array.from({ length: months }, (_, n) => {
    const t = y0 * 12 + m0 + n
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`
  })
}

/** Devolução prevista na desistência: fração do que o aluno pagou (arredondada para baixo, em centavos). */
export function refundOnWithdrawal(paid: Cents, refundBp: number): { refund: Cents; retained: Cents } {
  const refund = paid > 0 ? Math.floor((paid * refundBp) / 10_000) : 0
  return { refund, retained: Math.max(0, paid - refund) }
}
