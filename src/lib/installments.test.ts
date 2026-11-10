import { describe, it, expect } from 'vitest'
import { delinquency, distribute, dueDates, maxPayment, penaltyFor, refundOnWithdrawal, situation, situations, validPayments, type InstallmentLike, type PaymentLike } from './installments'

// Mesmos cenários de supabase/tests/20_regras.sql (A–F). Hoje = 2027-05-20.
const TODAY = '2027-05-20'
const PAST = '2027-05-10' // venceu há 10 dias
const FUTURE = '2027-05-30'
const inst = (id: string, dueDate: string, amount = 10_000): InstallmentLike => ({ id, studentId: 's', number: 1, dueDate, amount, penaltyBp: 1_500 })
const pay = (installmentId: string, amount: number, paidAt: string, id = `${installmentId}-${amount}-${paidAt}`, reversalOf: string | null = null): PaymentLike =>
  ({ id, installmentId, amount, paidAt, reversalOf })

describe('situação da parcela (igual ao banco)', () => {
  it('A: paga em dia, sem adicional', () => {
    expect(situation(inst('a', PAST), [pay('a', 10_000, '2027-05-09')], TODAY)).toMatchObject({ status: 'paga', penalty: 0, remaining: 0 })
  })
  it('B: R$ 40 no prazo e vencida → atrasada, adicional de 15% sobre os R$ 60 que faltaram', () => {
    expect(situation(inst('b', PAST), [pay('b', 4_000, '2027-05-08')], TODAY)).toEqual({ amount: 10_000, penalty: 900, due: 10_900, paid: 4_000, remaining: 6_900, status: 'atrasada' })
  })
  it('B no dia do vencimento: parcial, sem adicional', () => {
    expect(situation(inst('b', PAST), [pay('b', 4_000, '2027-05-08')], PAST)).toMatchObject({ status: 'parcial', penalty: 0 })
  })
  it('C: parcial dentro do prazo', () => {
    expect(situation(inst('c', FUTURE), [pay('c', 3_000, TODAY)], TODAY)).toMatchObject({ status: 'parcial', penalty: 0, remaining: 7_000 })
  })
  it('D: nada pago, dentro do prazo → pendente', () => {
    expect(situation(inst('d', FUTURE), [], TODAY)).toMatchObject({ status: 'pendente', remaining: 10_000 })
  })
  it('E: nada pago e vencida → adicional cheio', () => {
    expect(situation(inst('e', PAST), [], TODAY)).toMatchObject({ status: 'atrasada', penalty: 1_500, due: 11_500 })
  })
  it('F: adicional arredonda ao centavo (10001 × 15% = 1500,15 → 1500)', () => {
    expect(situation(inst('f', PAST, 10_001), [], TODAY).penalty).toBe(1_500)
  })
  it('pagamento parcial nunca quita, mesmo com centavo faltando', () => {
    expect(situation(inst('g', FUTURE), [pay('g', 9_999, TODAY)], TODAY).status).toBe('parcial')
  })
  it('quitar depois do vencimento exige o adicional', () => {
    expect(situation(inst('e', PAST), [pay('e', 10_000, TODAY)], TODAY)).toMatchObject({ status: 'atrasada', remaining: 1_500 })
    expect(situation(inst('e', PAST), [pay('e', 11_500, TODAY)], TODAY).status).toBe('paga')
  })
  it('pagamento de outra parcela não conta', () => {
    expect(situation(inst('d', FUTURE), [pay('x', 10_000, TODAY)], TODAY).status).toBe('pendente')
  })
})

describe('estornos', () => {
  it('pagamento estornado e o próprio estorno saem da conta', () => {
    const p = pay('b', 6_900, TODAY, 'p1')
    const r = pay('b', -6_900, TODAY, 'r1', 'p1')
    expect(validPayments([p, r])).toEqual([])
    const [s] = situations([inst('b', PAST)], [pay('b', 4_000, '2027-05-08'), p, r], TODAY)
    expect(s).toMatchObject({ status: 'atrasada', remaining: 6_900 })
  })
})

describe('adicional', () => {
  it.each([[0, 1500, 0], [10_000, 0, 0], [10_000, 1500, 1500], [6_000, 1500, 900], [3, 1500, 0], [4, 1500, 1], [10_001, 1500, 1500]])(
    'faltou %i com %i bp → %i', (s, bp, out) => expect(penaltyFor(s, bp)).toBe(out))
})

describe('quanto cabe na parcela', () => {
  it('no prazo: valor − pago, sem adicional', () => {
    expect(maxPayment(inst('c', FUTURE), [pay('c', 3_000, TODAY)], TODAY, TODAY)).toBe(7_000)
  })
  it('pagamento retroativo dentro do prazo não paga adicional', () => {
    expect(maxPayment(inst('e', PAST), [], '2027-05-09', TODAY)).toBe(10_000)
  })
  it('depois do vencimento: inclui o adicional', () => {
    expect(maxPayment(inst('e', PAST), [], TODAY, TODAY)).toBe(11_500)
  })
})

describe('distribuição nas parcelas em aberto', () => {
  const list = [{ ...inst('p2', '2027-06-10'), number: 2 }, { ...inst('p1', FUTURE), number: 1 }, { ...inst('p3', '2027-07-10'), number: 3 }]
  it('R$ 250 → 100 + 100 + 50, da mais antiga para a mais nova', () => {
    const { parts, leftover } = distribute(25_000, list, [], TODAY, TODAY)
    expect(parts.map((p) => [p.installment.id, p.amount])).toEqual([['p1', 10_000], ['p2', 10_000], ['p3', 5_000]])
    expect(leftover).toBe(0)
  })
  it('pula parcela já paga e informa a sobra', () => {
    const { parts, leftover } = distribute(25_000, list, [pay('p1', 10_000, TODAY)], TODAY, TODAY)
    expect(parts.map((p) => p.installment.id)).toEqual(['p2', 'p3'])
    expect(leftover).toBe(5_000)
  })
})

describe('inadimplência', () => {
  it('conta parcelas e alunos em atraso e o total em aberto', () => {
    expect(delinquency([
      { studentId: 'a', status: 'atrasada', remaining: 11_500 },
      { studentId: 'a', status: 'atrasada', remaining: 6_900 },
      { studentId: 'b', status: 'parcial', remaining: 7_000 },
      { studentId: 'c', status: 'paga', remaining: 0 },
    ])).toEqual({ lateCount: 2, lateAmount: 18_400, lateStudents: 1, openAmount: 25_400, paidCount: 1 })
  })
})

describe('vencimentos', () => {
  it('18 parcelas a partir de mar/2027, todo dia 10, virando o ano', () => {
    const d = dueDates('2027-03', 18, 10)
    expect(d[0]).toBe('2027-03-10')
    expect(d[9]).toBe('2027-12-10')
    expect(d[10]).toBe('2028-01-10')
    expect(d.at(-1)).toBe('2028-08-10')
  })
})

describe('devolução na desistência', () => {
  it('80% de R$ 1.000 → devolve R$ 800 e retém R$ 200', () => {
    expect(refundOnWithdrawal(100_000, 8_000)).toEqual({ refund: 80_000, retained: 20_000 })
  })
  it('arredonda a devolução para baixo, sem perder centavo', () => {
    const r = refundOnWithdrawal(333, 8_000)
    expect(r.refund + r.retained).toBe(333)
    expect(r.refund).toBe(266)
  })
  it('nada pago, nada a devolver', () => expect(refundOnWithdrawal(0, 8_000)).toEqual({ refund: 0, retained: 0 }))
})
