import { describe, it, expect } from 'vitest'
import { monthClosing, monthRange, previousMonth, reconcile } from './closing'
import type { LedgerEntry } from './ledger'

const e = (origin: LedgerEntry['origin'], date: string, amount: number, id: string): LedgerEntry => ({ origin, id, date, amount, reversal: false, description: null })
const ledger = [
  e('mensalidade', '2027-02-08', 10_000, 'p1'), e('mensalidade', '2027-03-08', 10_000, 'p2'),
  e('arrecadacao', '2027-03-15', 50_000, 'f1'), e('despesa', '2027-03-20', -3_000, 'd1'), e('despesa', '2027-03-21', -2_000, 'd2'),
  e('rendimento', '2027-03-31', 150, 'y1'),
]

describe('meses', () => {
  it('intervalo do mês, inclusive fevereiro e bissexto', () => {
    expect(monthRange('2027-02')).toEqual({ from: '2027-02-01', to: '2027-02-28' })
    expect(monthRange('2028-02').to).toBe('2028-02-29')
    expect(monthRange('2027-12').to).toBe('2027-12-31')
  })
  it('mês anterior vira o ano', () => { expect(previousMonth('2027-01')).toBe('2026-12'); expect(previousMonth('2027-10')).toBe('2027-09') })
})

describe('fechamento mensal', () => {
  const inst = (id: string, studentId: string, dueDate: string) => ({ id, studentId, number: 1, dueDate, amount: 10_000, penaltyBp: 1_500 })
  const c = monthClosing({
    month: '2027-03', ledger,
    installments: [inst('i1', 'a', '2027-03-10'), inst('i2', 'b', '2027-03-10'), inst('i3', 'c', '2027-03-10'), inst('i4', 'a', '2027-04-10')],
    payments: [{ id: 'p2', installmentId: 'i1', amount: 10_000, paidAt: '2027-03-08', reversalOf: null }, { id: 'px', installmentId: 'i2', amount: 10_000, paidAt: '2027-04-02', reversalOf: null }],
    activeStudentIds: new Set(['a', 'b']),
    expenses: [{ id: 'd1', date: '2027-03-20', amount: 3_000, reversalOf: null }, { id: 'd2', date: '2027-03-21', amount: 2_000, reversalOf: null }],
    expenseIdsWithReceipt: new Set(['d1']),
    checkedKeys: new Set(['mensalidade:p2', 'despesa:d1']),
  })
  it('saldo inicial, entradas, saídas e saldo final do mês', () => {
    expect(c).toMatchObject({ opening: 10_000, tuition: 10_000, fundraisingNet: 50_000, yields: 150, expenses: 5_000, closing: 65_150 })
  })
  it('inadimplência na virada do mês ignora pagamento posterior e desistentes', () => {
    // b pagou só em abril: em 31/03 estava atrasado (valor + 15%); c é desistente
    expect(c).toMatchObject({ lateCount: 1, lateStudents: 1, lateAmount: 11_500 })
  })
  it('pendências de comprovante e conferência', () => {
    expect(c).toMatchObject({ noReceiptCount: 1, noReceiptAmount: 2_000, uncheckedCount: 3 })
  })
})

describe('conciliação com o banco', () => {
  it('compara o extrato com o registrado até a mesma data', () => {
    expect(reconcile(ledger, { date: '2027-03-15', amount: 70_000 })).toEqual({ date: '2027-03-15', bank: 70_000, registered: 70_000, difference: 0 })
    expect(reconcile(ledger, { date: '2027-03-31', amount: 65_000 })?.difference).toBe(-150)
    expect(reconcile(ledger, null)).toBeNull()
  })
})
