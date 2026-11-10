import type { ProjectSettings } from '@/types/domain'

/**
 * Cenário inicial ILUSTRATIVO definido no briefing.
 * Nada aqui é definitivo: destino, preços, taxa e regras podem mudar.
 */
export const DEFAULT_SETTINGS: ProjectSettings = {
  destination: 'Beach Park',
  destinationCity: 'Aquiraz/CE',
  origin: 'Natal/RN',
  tripYear: 2028,
  days: 4,
  nights: 3,
  expectedStudents: 20,
  budgetPerStudent: 220_000,
  monthlyFee: 10_000,
  months: 18,
  annualRate: 0.12,
  dueDay: 10,
  latePenalty: 0.15,
  refundOnWithdrawal: 0.8,
  admin: 'Davi',
  supervisor: 'Professor(a) responsável',
}
