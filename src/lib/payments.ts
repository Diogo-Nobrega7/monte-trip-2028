import type { Cents } from '@/types/domain'

/**
 * Converte o que a pessoa digitou ("100", "1.234,56", "R$ 75,5") em centavos.
 * Retorna null para texto inválido, zero ou negativo. Nunca passa por float.
 */
export function parseMoney(input: string): Cents | null {
  const s = input.replace(/R\$|\s/g, '')
  if (!s) return null
  // aceita "1.234,56", "1234,56", "1234.56" e "1234"
  let m = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(s)
  let int: string, dec: string
  if (m) { int = m[1].replace(/\./g, ''); dec = m[2] ?? '' }
  else {
    m = /^(\d+)\.(\d{1,2})$/.exec(s)
    if (!m) return null
    int = m[1]; dec = m[2]
  }
  const cents = Number(int) * 100 + Number(dec.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents <= 0) return null
  return cents
}

export interface PaymentLike { id: string; studentId: string; amount: Cents; reversalOf: string | null }

/** Total pago por aluno (estornos já descontados). */
export function totalsByStudent(payments: PaymentLike[]): Map<string, Cents> {
  const t = new Map<string, Cents>()
  for (const p of payments) t.set(p.studentId, (t.get(p.studentId) ?? 0) + p.amount)
  return t
}

/** Ids de pagamentos que já foram estornados. */
export function reversedIds(payments: PaymentLike[]): Set<string> {
  return new Set(payments.flatMap((p) => (p.reversalOf ? [p.reversalOf] : [])))
}

/** Soma geral (estornos já descontados). */
export const totalRaised = (payments: PaymentLike[]): Cents => payments.reduce((s, p) => s + p.amount, 0)
