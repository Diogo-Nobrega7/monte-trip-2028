import type { Cents } from '@/types/domain'

/**
 * Funções financeiras puras, testadas em finance.test.ts.
 * Convenção: depósitos no FINAL de cada mês; taxa mensal equivalente à anual.
 */

/** Taxa mensal equivalente: (1 + a)^(1/12) − 1 */
export function monthlyRate(annualRate: number): number {
  if (annualRate <= -1) throw new RangeError('Taxa anual inválida')
  return Math.pow(1 + annualRate, 1 / 12) - 1
}

export interface MonthPoint {
  month: number
  deposited: Cents
  balance: Cents
  yield: Cents
}

/** Evolução mês a mês. Saldo em ponto flutuante, arredondado só na saída. */
export function projectDeposits(monthly: Cents, months: number, annualRate: number): MonthPoint[] {
  if (!Number.isInteger(months) || months < 0) throw new RangeError('Período inválido')
  if (monthly < 0) throw new RangeError('Depósito inválido')
  const i = monthlyRate(annualRate)
  const points: MonthPoint[] = []
  let balance = 0
  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + i) + monthly
    const deposited = monthly * m
    const b = Math.round(balance)
    points.push({ month: m, deposited, balance: b, yield: b - deposited })
  }
  return points
}

/** Valor futuro fechado: PMT · ((1+i)^n − 1) / i */
export function futureValue(monthly: Cents, months: number, annualRate: number): Cents {
  const i = monthlyRate(annualRate)
  if (i === 0) return monthly * months
  return Math.round((monthly * (Math.pow(1 + i, months) - 1)) / i)
}

export interface Scenario {
  perStudentDeposited: Cents
  perStudentBalance: Cents
  groupBalance: Cents
  groupBudget: Cents
  gap: Cents // positivo = falta; negativo = sobra
  coverage: number
}

export function scenario(p: {
  monthly: Cents
  months: number
  annualRate: number
  students: number
  budgetPerStudent: Cents
  extraRevenue?: Cents
}): Scenario {
  const perStudentBalance = futureValue(p.monthly, p.months, p.annualRate)
  const groupBalance = perStudentBalance * p.students + (p.extraRevenue ?? 0)
  const groupBudget = p.budgetPerStudent * p.students
  return {
    perStudentDeposited: p.monthly * p.months,
    perStudentBalance,
    groupBalance,
    groupBudget,
    gap: groupBudget - groupBalance,
    coverage: groupBudget === 0 ? 0 : groupBalance / groupBudget,
  }
}
