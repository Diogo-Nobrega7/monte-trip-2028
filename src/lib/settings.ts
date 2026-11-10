import type { ProjectSettings } from '@/types/domain'
import { money, percent } from './format'

/**
 * Configurações: conversão entre o formato do banco (chaves em português, percentuais em
 * pontos-base) e o domínio, validação (mesmas regras de validar_configuracoes() no banco)
 * e diferença entre versões. Funções puras, testadas em settings.test.ts.
 */

/** Formato gravado em config_versions.valores. */
export interface DbSettings {
  destino: string
  cidade_destino: string
  origem: string
  ano: number
  data_ida: string | null
  data_volta: string | null
  dias: number
  noites: number
  alunos_previstos: number
  orcamento_por_aluno: number
  mensalidade: number
  parcelas: number
  mes_inicio: string | null
  dia_vencimento: number
  adicional_atraso_bp: number
  devolucao_desistencia_bp: number
  novos_pagam_anteriores: boolean
  rendimento_anual_bp: number
  administrador: string
  supervisor: string
  provisorio: boolean
}
export type DbKey = keyof DbSettings

/** Chaves que só mudam com aprovação do professor (igual a chaves_financeiras() no banco). */
export const FINANCIAL_KEYS: readonly DbKey[] = [
  'mensalidade', 'parcelas', 'mes_inicio', 'dia_vencimento', 'adicional_atraso_bp',
  'devolucao_desistencia_bp', 'novos_pagam_anteriores', 'provisorio',
]

const bp = (fraction: number) => Math.round(fraction * 10_000)

export function toDb(s: ProjectSettings): DbSettings {
  return {
    destino: s.destination.trim(), cidade_destino: s.destinationCity.trim(), origem: s.origin.trim(),
    ano: s.tripYear, data_ida: s.tripStart || null, data_volta: s.tripEnd || null, dias: s.days, noites: s.nights,
    alunos_previstos: s.expectedStudents, orcamento_por_aluno: s.budgetPerStudent, mensalidade: s.monthlyFee,
    parcelas: s.months, mes_inicio: s.startMonth || null, dia_vencimento: s.dueDay,
    adicional_atraso_bp: bp(s.latePenalty), devolucao_desistencia_bp: bp(s.refundOnWithdrawal),
    novos_pagam_anteriores: s.newJoinersPayPast, rendimento_anual_bp: bp(s.annualRate),
    administrador: s.admin.trim(), supervisor: s.supervisor.trim(), provisorio: s.provisional,
  }
}

export function fromDb(v: DbSettings): ProjectSettings {
  return {
    destination: v.destino, destinationCity: v.cidade_destino, origin: v.origem, tripYear: v.ano,
    tripStart: v.data_ida, tripEnd: v.data_volta, days: v.dias, nights: v.noites,
    expectedStudents: v.alunos_previstos, budgetPerStudent: v.orcamento_por_aluno, monthlyFee: v.mensalidade,
    months: v.parcelas, startMonth: v.mes_inicio, dueDay: v.dia_vencimento,
    latePenalty: v.adicional_atraso_bp / 10_000, refundOnWithdrawal: v.devolucao_desistencia_bp / 10_000,
    newJoinersPayPast: v.novos_pagam_anteriores, annualRate: v.rendimento_anual_bp / 10_000,
    admin: v.administrador, supervisor: v.supervisor, provisional: v.provisorio,
  }
}

const int = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max
const text = (t: unknown) => typeof t === 'string' && t.trim().length >= 1 && t.trim().length <= 80
const isoDate = (d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d))

/** Erros por campo do domínio (vazio = válido). Espelha validar_configuracoes() do banco. */
export function validateSettings(s: ProjectSettings): Partial<Record<keyof ProjectSettings, string>> {
  const e: Partial<Record<keyof ProjectSettings, string>> = {}
  const v = toDb(s)
  if (!text(v.destino)) e.destination = 'Informe o destino (até 80 caracteres).'
  if (!text(v.cidade_destino)) e.destinationCity = 'Informe a cidade (até 80 caracteres).'
  if (!text(v.origem)) e.origin = 'Informe a cidade de saída.'
  if (!text(v.administrador)) e.admin = 'Informe quem administra.'
  if (!text(v.supervisor)) e.supervisor = 'Informe o professor responsável.'
  if (!int(v.ano, 2026, 2040)) e.tripYear = 'Ano entre 2026 e 2040.'
  if (!int(v.dias, 1, 30)) e.days = 'De 1 a 30 dias.'
  if (!int(v.noites, 0, 30)) e.nights = 'De 0 a 30 noites.'
  else if (int(v.dias, 1, 30) && v.noites > v.dias) e.nights = 'Noites não podem passar do número de dias.'
  if (!int(v.alunos_previstos, 1, 300)) e.expectedStudents = 'De 1 a 300 participantes.'
  if (!int(v.orcamento_por_aluno, 0, 10_000_000)) e.budgetPerStudent = 'Valor inválido.'
  if (!int(v.mensalidade, 100, 1_000_000)) e.monthlyFee = 'Entre R$ 1,00 e R$ 10.000,00.'
  if (!int(v.parcelas, 1, 60)) e.months = 'De 1 a 60 parcelas.'
  if (!int(v.dia_vencimento, 1, 28)) e.dueDay = 'Dia de 1 a 28 (todo mês tem).'
  if (!int(v.adicional_atraso_bp, 0, 10_000)) e.latePenalty = 'Percentual de 0% a 100%.'
  if (!int(v.devolucao_desistencia_bp, 0, 10_000)) e.refundOnWithdrawal = 'Percentual de 0% a 100%.'
  if (!int(v.rendimento_anual_bp, 0, 5_000)) e.annualRate = 'De 0% a 50% ao ano.'
  if (v.mes_inicio !== null && !/^20[2-4]\d-(0[1-9]|1[0-2])$/.test(v.mes_inicio)) e.startMonth = 'Use o formato AAAA-MM.'
  if (v.data_ida !== null && !isoDate(v.data_ida)) e.tripStart = 'Data inválida.'
  if (v.data_volta !== null && !isoDate(v.data_volta)) e.tripEnd = 'Data inválida.'
  if (v.data_ida && v.data_volta && isoDate(v.data_ida) && isoDate(v.data_volta) && v.data_volta < v.data_ida) e.tripEnd = 'A volta não pode ser antes da ida.'
  return e
}

export interface Change { key: DbKey; from: unknown; to: unknown; financial: boolean }

/** Campos que mudaram entre duas configurações (no formato do banco). */
export function diffSettings(before: DbSettings, after: DbSettings): Change[] {
  return (Object.keys(LABELS) as DbKey[])
    .filter((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null))
    .map((k) => ({ key: k, from: before[k] ?? null, to: after[k] ?? null, financial: FINANCIAL_KEYS.includes(k) }))
}

export const LABELS: Record<DbKey, string> = {
  destino: 'Destino', cidade_destino: 'Cidade do destino', origem: 'Saída', ano: 'Ano da viagem',
  data_ida: 'Data de ida', data_volta: 'Data de volta', dias: 'Dias', noites: 'Noites',
  alunos_previstos: 'Participantes previstos', orcamento_por_aluno: 'Orçamento por aluno',
  mensalidade: 'Mensalidade', parcelas: 'Número de parcelas', mes_inicio: 'Mês da primeira parcela',
  dia_vencimento: 'Dia de vencimento', adicional_atraso_bp: 'Adicional por atraso',
  devolucao_desistencia_bp: 'Devolução na desistência', novos_pagam_anteriores: 'Quem entra depois paga parcelas anteriores',
  rendimento_anual_bp: 'Rendimento anual (hipotético)', administrador: 'Administração', supervisor: 'Supervisão',
  provisorio: 'Regras provisórias',
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
/** '2027-03' → 'mar/2027' */
export const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]}/${ym.slice(0, 4)}`

/** Valor de um campo do banco em texto para o histórico. */
export function formatSettingValue(key: DbKey, v: unknown): string {
  if (v === null || v === undefined || v === '') return 'não definido'
  switch (key) {
    case 'orcamento_por_aluno': case 'mensalidade': return money(Number(v))
    case 'adicional_atraso_bp': case 'devolucao_desistencia_bp': case 'rendimento_anual_bp': return percent(Number(v) / 10_000)
    case 'novos_pagam_anteriores': case 'provisorio': return v ? 'Sim' : 'Não'
    case 'mes_inicio': return monthLabel(String(v))
    case 'data_ida': case 'data_volta': return String(v).split('-').reverse().join('/')
    case 'dia_vencimento': return `dia ${v}`
    default: return String(v)
  }
}

/** Último mês de cobrança, 'AAAA-MM', a partir do mês inicial e do número de parcelas. */
export function lastMonth(startMonth: string, months: number): string {
  const total = Number(startMonth.slice(0, 4)) * 12 + Number(startMonth.slice(5, 7)) - 1 + months - 1
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

/** "15", "15,5", "12.5%" → fração (0.15, 0.155, 0.125). Null se inválido. Arredonda a pontos-base. */
export function parsePercent(input: string): number | null {
  const s = input.replace(/%|\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  const [i, d = ''] = s.split('.')
  return (Number(i) * 100 + Number(d.padEnd(2, '0'))) / 10_000
}

/** Fração → texto para campo de formulário: 0.155 → "15,5". */
export const percentInput = (f: number) => String(Math.round(f * 10_000) / 100).replace('.', ',')
