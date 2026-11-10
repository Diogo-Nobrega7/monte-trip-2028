import { describe, it, expect } from 'vitest'
import { futureValue, monthlyRate, projectDeposits, scenario } from './finance'

// Referência: tabela do briefing (18 meses, 12% a.a., depósitos no fim do mês).
describe('finance', () => {
  it('taxa mensal equivalente a 12% a.a. ≈ 0,9489%', () => {
    expect(monthlyRate(0.12)).toBeCloseTo(0.0094888, 6)
  })

  it.each([
    [5_000, 90_000, 97_600],
    [7_500, 135_000, 146_500],
    [10_000, 180_000, 195_300],
  ])('mensalidade %i centavos → depositado %i, saldo ≈ %i (±R$1)', (pmt, dep, bal) => {
    const last = projectDeposits(pmt, 18, 0.12).at(-1)!
    expect(last.deposited).toBe(dep)
    expect(Math.abs(last.balance - bal)).toBeLessThanOrEqual(100)
  })

  it('evolução iterativa coincide com a fórmula fechada', () => {
    expect(projectDeposits(10_000, 18, 0.12).at(-1)!.balance).toBe(futureValue(10_000, 18, 0.12))
  })

  it('taxa zero não rende', () => {
    expect(futureValue(10_000, 18, 0)).toBe(180_000)
  })

  it('20 alunos a R$100 ≈ R$39.060; falta ≈ R$4.940', () => {
    const s = scenario({ monthly: 10_000, months: 18, annualRate: 0.12, students: 20, budgetPerStudent: 220_000 })
    expect(Math.abs(s.groupBalance - 3_906_000)).toBeLessThanOrEqual(2_000)
    expect(s.groupBudget).toBe(4_400_000)
    expect(Math.abs(s.gap - 494_000)).toBeLessThanOrEqual(2_000)
  })

  it('rejeita entradas inválidas', () => {
    expect(() => projectDeposits(10_000, -1, 0.12)).toThrow()
    expect(() => projectDeposits(-1, 12, 0.12)).toThrow()
  })
})
