/**
 * Tipos básicos do domínio. As tabelas estão em supabase/migrations e docs/ARQUITETURA.md.
 * Valores monetários sempre em CENTAVOS (inteiros) para evitar erro de ponto flutuante.
 */
export type Cents = number
export type ISODate = string // 'YYYY-MM-DD'


/**
 * Parâmetros do projeto — editáveis em Configurações, gravados com histórico no banco
 * (tabela config_versions). Percentuais aqui são frações (0.15 = 15%); no banco, pontos-base.
 */
export interface ProjectSettings {
  destination: string
  destinationCity: string
  origin: string
  tripYear: number
  /** Datas previstas da viagem (opcionais até a contratação). */
  tripStart: ISODate | null
  tripEnd: ISODate | null
  days: number
  nights: number
  expectedStudents: number
  budgetPerStudent: Cents
  monthlyFee: Cents
  months: number
  /** Mês da primeira parcela, 'AAAA-MM'. Null enquanto não definido. */
  startMonth: string | null
  annualRate: number // 0.12 = 12% a.a. (hipotético)
  dueDay: number
  latePenalty: number // 0.15
  refundOnWithdrawal: number // 0.8
  /** Quem entra depois do início paga as parcelas que já venceram? */
  newJoinersPayPast: boolean
  admin: string
  supervisor: string
  /** Regras ainda não aprovadas como definitivas pelo professor. */
  provisional: boolean
}

// Linhas de cada tabela: tipos em src/data/*.ts (repo, installments, cash, agencies, documents).
