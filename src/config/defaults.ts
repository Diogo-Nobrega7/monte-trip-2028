import type { ProjectSettings } from '@/types/domain'

/**
 * Cenário inicial ILUSTRATIVO definido no briefing. É a mesma versão 1 gravada pela migração
 * 0002_configuracoes.sql. Só é usado no modo demonstração (sem banco); com banco, vale a
 * configuração vigente de lá, nunca esta.
 */
export const DEFAULT_SETTINGS: ProjectSettings = {
  destination: 'Beach Park',
  destinationCity: 'Aquiraz/CE',
  origin: 'Natal/RN',
  tripYear: 2028,
  tripStart: null,
  tripEnd: null,
  days: 4,
  nights: 3,
  expectedStudents: 20,
  budgetPerStudent: 220_000,
  monthlyFee: 10_000,
  months: 18,
  startMonth: null,
  annualRate: 0.12,
  dueDay: 10,
  latePenalty: 0.15,
  refundOnWithdrawal: 0.8,
  newJoinersPayPast: true,
  admin: 'Davi',
  supervisor: 'Professor(a) responsável',
  provisional: true,
}
