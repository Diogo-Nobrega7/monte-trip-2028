import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS } from '@/config/defaults'
import { diffSettings, formatSettingValue, fromDb, lastMonth, toDb, validateSettings } from './settings'

describe('configurações', () => {
  it('ida e volta entre domínio e banco não perde nada', () => {
    expect(fromDb(toDb(DEFAULT_SETTINGS))).toEqual(DEFAULT_SETTINGS)
  })
  it('percentuais viram pontos-base inteiros', () => {
    const v = toDb({ ...DEFAULT_SETTINGS, latePenalty: 0.155, annualRate: 0.1075 })
    expect(v.adicional_atraso_bp).toBe(1_550)
    expect(v.rendimento_anual_bp).toBe(1_075)
  })
  it('padrão é válido', () => expect(validateSettings(DEFAULT_SETTINGS)).toEqual({}))
  it.each([
    ['dueDay', 31], ['months', 0], ['monthlyFee', 50.5], ['nights', 5], ['tripYear', 2025], ['expectedStudents', 0], ['annualRate', 0.6],
  ] as const)('recusa %s = %s', (k, v) => {
    expect(Object.keys(validateSettings({ ...DEFAULT_SETTINGS, [k]: v }))).toContain(k)
  })
  it('recusa volta antes da ida e mês inicial mal formatado', () => {
    const e = validateSettings({ ...DEFAULT_SETTINGS, tripStart: '2028-07-10', tripEnd: '2028-07-01', startMonth: '2027-13' })
    expect(e.tripEnd).toBeTruthy()
    expect(e.startMonth).toBeTruthy()
  })
  it('diferença marca o que precisa de aprovação', () => {
    const after = toDb({ ...DEFAULT_SETTINGS, destination: 'Fortaleza', monthlyFee: 12_000 })
    const d = diffSettings(toDb(DEFAULT_SETTINGS), after)
    expect(d).toEqual([
      { key: 'destino', from: 'Beach Park', to: 'Fortaleza', financial: false },
      { key: 'mensalidade', from: 10_000, to: 12_000, financial: true },
    ])
  })
  it('formata valores para o histórico', () => {
    expect(formatSettingValue('mensalidade', 12_000)).toMatch(/120,00/)
    expect(formatSettingValue('adicional_atraso_bp', 1_500)).toBe('15%')
    expect(formatSettingValue('mes_inicio', '2027-03')).toBe('mar/2027')
    expect(formatSettingValue('mes_inicio', null)).toBe('não definido')
    expect(formatSettingValue('provisorio', false)).toBe('Não')
  })
  it('último mês de cobrança', () => {
    expect(lastMonth('2027-03', 18)).toBe('2028-08')
    expect(lastMonth('2027-12', 1)).toBe('2027-12')
  })
})

import { parsePercent, percentInput } from './settings'
describe('percentuais digitados', () => {
  it.each([['15', 0.15], ['15,5', 0.155], ['12.5%', 0.125], ['0', 0], ['100', 1], [' 7,25 ', 0.0725]])('"%s" → %s', (i, o) => expect(parsePercent(i)).toBe(o))
  it.each(['', 'abc', '-5', '1,234'])('"%s" é inválido', (i) => expect(parsePercent(i)).toBeNull())
  it('volta para texto', () => { expect(percentInput(0.155)).toBe('15,5'); expect(percentInput(0.12)).toBe('12') })
})
