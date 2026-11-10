import { describe, it, expect } from 'vitest'
import { parseMoney, reversedIds, totalRaised, totalsByStudent, type PaymentLike } from './payments'

describe('parseMoney', () => {
  it.each([
    ['100', 10_000],
    ['100,5', 10_050],
    ['100,50', 10_050],
    ['1.234,56', 123_456],
    ['1234,56', 123_456],
    ['1234.56', 123_456],
    ['R$ 75,00', 7_500],
    ['0,01', 1],
  ])('"%s" → %i centavos', (input, cents) => {
    expect(parseMoney(input)).toBe(cents)
  })

  it.each(['', 'abc', '0', '0,00', '-10', '10,999', '1,2,3', '12.3456'])('rejeita "%s"', (input) => {
    expect(parseMoney(input)).toBeNull()
  })

  it('não sofre erro de ponto flutuante', () => {
    expect(parseMoney('0,29')).toBe(29)
    expect(parseMoney('1,15')).toBe(115)
  })
})

describe('totais de pagamentos', () => {
  const pays: PaymentLike[] = [
    { id: 'p1', studentId: 'a', amount: 10_000, reversalOf: null },
    { id: 'p2', studentId: 'a', amount: 5_000, reversalOf: null },
    { id: 'p3', studentId: 'b', amount: 10_000, reversalOf: null },
    { id: 'p4', studentId: 'a', amount: -5_000, reversalOf: 'p2' },
  ]

  it('soma por aluno descontando estorno', () => {
    const t = totalsByStudent(pays)
    expect(t.get('a')).toBe(10_000)
    expect(t.get('b')).toBe(10_000)
    expect(t.get('c')).toBeUndefined()
  })

  it('soma geral', () => {
    expect(totalRaised(pays)).toBe(20_000)
    expect(totalRaised([])).toBe(0)
  })

  it('identifica pagamentos estornados', () => {
    expect([...reversedIds(pays)]).toEqual(['p2'])
  })
})
