import { describe, it, expect } from 'vitest'
import { formatCnpj, isValidCnpj } from './cnpj'
import { centsToDecimal, parseCsv, toCsv } from './csv'
import { importable, parseDate, parseStudentRows } from './import'
import { inRange, presetRange, rangeLabel } from './period'
import { bestByCriterion, includedCount, type ProposalLike } from './proposals'
import { monthlySeries, summarize, withRunningBalance, type LedgerEntry } from './ledger'

describe('CNPJ (igual a cnpj_valido() no banco)', () => {
  it('confere dígitos verificadores', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true)
    expect(isValidCnpj('11222333000180')).toBe(false)
    expect(isValidCnpj('11111111111111')).toBe(false)
    expect(isValidCnpj('123')).toBe(false)
  })
  it('formata', () => expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81'))
})

describe('CSV', () => {
  it('centavos viram decimal com vírgula, sem float', () => {
    expect(centsToDecimal(123_456)).toBe('1234,56')
    expect(centsToDecimal(-5)).toBe('-0,05')
    expect(centsToDecimal(0)).toBe('0,00')
  })
  it('gera ; com aspas quando precisa e bloqueia fórmulas', () => {
    const csv = toCsv(['Nome', 'Valor'], [['Ana; Bia', '10,00'], ['=CMD()', '-5,00'], [null, true]])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('"Ana; Bia";10,00')
    expect(csv).toContain("'=CMD();-5,00")
    expect(csv).toContain(';sim')
  })
  it('lê ; ou , com aspas e quebra de linha', () => {
    expect(parseCsv('﻿nome;responsável\r\n"Silva; Ana";Maria\r\n\r\n')).toEqual([['nome', 'responsável'], ['Silva; Ana', 'Maria']])
    expect(parseCsv('a,b\n"x ""y""",z')).toEqual([['a', 'b'], ['x "y"', 'z']])
    expect(parseCsv('a;b\n"linha\nquebrada";2')).toEqual([['a', 'b'], ['linha\nquebrada', '2']])
  })
  it('volta igual ao que foi gerado', () => {
    const rows = [['João "JJ"', '1,00'], ['Maria; Souza', '']]
    expect(parseCsv(toCsv(['A', 'B'], rows))).toEqual([['A', 'B'], ...rows])
  })
})

describe('importação de alunos', () => {
  const TODAY = '2027-03-15'
  it('datas em vários formatos', () => {
    expect(parseDate('10/03/2027')).toBe('2027-03-10')
    expect(parseDate('2027-03-10')).toBe('2027-03-10')
    expect(parseDate('46456')).toBe('2027-03-10')
    expect(parseDate('31/02/2027')).toBeNull()
    expect(parseDate('ontem')).toBeNull()
  })
  it('detecta colunas, valida e marca duplicados', () => {
    const { rows, missingName } = parseStudentRows([
      ['Nome do aluno', 'Responsável', 'Telefone', 'Data de adesão'],
      ['Ana Souza', 'Maria Souza', '84 99999-0000', '01/03/2027'],
      ['ana  souza', 'Maria', '', ''],
      ['Bruno Lima', '', '', ''],
      ['X', '', '', '40/40/2027'],
      ['Carla Dias', '', '', '01/01/2030'],
    ], ['Bruno Lima'], TODAY)
    expect(missingName).toBe(false)
    expect(rows[0]).toMatchObject({ line: 2, name: 'Ana Souza', guardianName: 'Maria Souza', joinedAt: '2027-03-01', errors: [], duplicate: null })
    expect(rows[1].duplicate).toBe('arquivo')
    expect(rows[1].joinedAt).toBe(TODAY)
    expect(rows[2].duplicate).toBe('cadastro')
    expect(rows[3].errors).toHaveLength(2)
    expect(rows[4].errors).toContain('Data de adesão no futuro')
    expect(importable(rows).map((r) => r.name)).toEqual(['Ana Souza'])
  })
  it('sem coluna de nome, avisa', () => {
    expect(parseStudentRows([['telefone'], ['1']], [], TODAY).missingName).toBe(true)
  })
})

describe('períodos', () => {
  it('atalhos relativos a hoje', () => {
    expect(presetRange('mes', '2027-03-15')).toEqual({ from: '2027-03-01', to: '2027-03-31' })
    expect(presetRange('mes_passado', '2027-03-15')).toEqual({ from: '2027-02-01', to: '2027-02-28' })
    expect(presetRange('mes_passado', '2027-01-10')).toEqual({ from: '2026-12-01', to: '2026-12-31' })
    expect(presetRange('90d', '2027-03-31')).toEqual({ from: '2027-01-01', to: '2027-03-31' })
    expect(presetRange('ano', '2027-03-15')).toEqual({ from: '2027-01-01', to: '2027-12-31' })
  })
  it('intervalo fechado nas pontas', () => {
    const r = { from: '2027-03-01', to: '2027-03-31' }
    expect(inRange('2027-03-01', r) && inRange('2027-03-31', r) && !inRange('2027-04-01', r)).toBe(true)
    expect(rangeLabel(r)).toBe('01/03/2027 a 31/03/2027')
    expect(rangeLabel({ from: null, to: null })).toBe('todo o período')
  })
})

describe('comparação de propostas', () => {
  const p = (id: string, price: number, validUntil: string | null, inc: string[], status: 'ativa' | 'descartada' = 'ativa'): ProposalLike =>
    ({ id, pricePerStudent: price, validUntil, status, services: Object.fromEntries(inc.map((k) => [k, { incluso: true }])) })
  const list = [
    p('a', 210_000, '2027-06-30', ['transporte', 'hospedagem', 'ingressos']),
    p('b', 198_000, '2027-04-30', ['transporte', 'hospedagem']),
    p('c', 198_000, '2027-02-01', ['transporte', 'hospedagem', 'ingressos', 'alimentacao']),
    p('d', 150_000, '2027-12-31', ['transporte'], 'descartada'),
  ]
  const best = bestByCriterion(list, '2027-03-01')
  it('menor preço (empate destaca as duas), ignorando descartadas', () => expect([...best.price].sort()).toEqual(['b', 'c']))
  it('mais serviços incluídos', () => expect([...best.included]).toEqual(['c']))
  it('maior validade entre as que não venceram', () => expect([...best.validity]).toEqual(['a']))
  it('marca vencidas e serviços por proposta', () => {
    expect([...best.expired]).toEqual(['c'])
    expect([...best.services.ingressos].sort()).toEqual(['a', 'c'])
    expect(includedCount(list[2].services)).toBe(4)
  })
  it('sem propostas ativas, nada é destacado', () => {
    const b = bestByCriterion([], '2027-03-01')
    expect(b.price.size + b.included.size + b.validity.size).toBe(0)
  })
})

describe('livro-caixa', () => {
  const e = (origin: LedgerEntry['origin'], date: string, amount: number, id = `${origin}${date}${amount}`): LedgerEntry =>
    ({ origin, id, date, amount, reversal: amount < 0 && origin !== 'despesa' && origin !== 'custo_arrecadacao', description: null })
  const entries = [
    e('mensalidade', '2027-01-10', 10_000), e('mensalidade', '2027-02-10', 10_000), e('mensalidade', '2027-02-11', -10_000),
    e('arrecadacao', '2027-02-15', 50_000), e('custo_arrecadacao', '2027-02-15', -12_000),
    e('despesa', '2027-03-01', -3_000), e('despesa', '2027-03-02', 3_000), e('despesa', '2027-03-05', -2_000),
    e('rendimento', '2027-03-31', 150),
  ]
  it('prestação de contas do período com saldo inicial', () => {
    expect(summarize(entries, { from: '2027-02-01', to: '2027-02-28' })).toEqual({
      opening: 10_000, tuition: 0, fundraisingNet: 38_000, yields: 0, expenses: 0, inflow: 38_000, outflow: 0, closing: 48_000,
    })
    const mar = summarize(entries, { from: '2027-03-01', to: '2027-03-31' })
    expect(mar).toMatchObject({ opening: 48_000, expenses: 2_000, yields: 150, closing: 46_150 })
  })
  it('todo o período fecha com a soma', () => {
    expect(summarize(entries, { from: null, to: null }).closing).toBe(entries.reduce((s, x) => s + x.amount, 0))
  })
  it('série mensal com meses sem movimento e saldo acumulado', () => {
    const s = monthlySeries([e('mensalidade', '2027-01-10', 100), e('despesa', '2027-03-01', -30)])
    expect(s).toEqual([
      { month: '2027-01', inflow: 100, outflow: 0, balance: 100 },
      { month: '2027-02', inflow: 0, outflow: 0, balance: 100 },
      { month: '2027-03', inflow: 0, outflow: 30, balance: 70 },
    ])
    expect(monthlySeries([])).toEqual([])
  })
  it('saldo corrente em ordem de data', () => {
    const r = withRunningBalance([e('despesa', '2027-03-01', -30), e('mensalidade', '2027-01-10', 100)])
    expect(r.map((x) => x.balance)).toEqual([100, 70])
  })
})
