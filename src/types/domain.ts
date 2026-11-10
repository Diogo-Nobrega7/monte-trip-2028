/**
 * Modelo de domínio. Espelha as tabelas planejadas (docs/ARQUITETURA.md).
 * Valores monetários sempre em CENTAVOS (inteiros) para evitar erro de ponto flutuante.
 */
export type Cents = number
export type ISODate = string // 'YYYY-MM-DD'

export type StudentStatus = 'ativo' | 'pendente' | 'desistente'
export type InstallmentStatus = 'aberta' | 'paga' | 'parcial' | 'atrasada'
export type FundraisingKind = 'rifa' | 'venda' | 'evento' | 'doacao' | 'patrocinio'
export type ExpenseCategory = 'agencia' | 'transporte' | 'hospedagem' | 'ingressos' | 'materiais' | 'taxas' | 'outros'

/** Parâmetros do projeto — todos provisórios e editáveis em Configurações. */
export interface ProjectSettings {
  destination: string
  destinationCity: string
  origin: string
  tripYear: number
  days: number
  nights: number
  expectedStudents: number
  budgetPerStudent: Cents
  monthlyFee: Cents
  months: number
  annualRate: number // 0.12 = 12% a.a. (hipotético)
  dueDay: number
  latePenalty: number // 0.15
  refundOnWithdrawal: number // 0.8
  admin: string
  supervisor: string
}

export interface Student { id: string; name: string; guardianName: string; joinedAt: ISODate; status: StudentStatus; paid: Cents; due: Cents }
export interface Installment { id: string; studentName: string; number: number; dueDate: ISODate; amount: Cents; paid: Cents; status: InstallmentStatus }
export interface Fundraising { id: string; kind: FundraisingKind; title: string; date: ISODate; gross: Cents; costs: Cents }
export interface Expense { id: string; category: ExpenseCategory; description: string; date: ISODate; amount: Cents; hasReceipt: boolean }
export interface Proposal { id: string; agency: string; contact: string; pricePerStudent: Cents; includes: string[]; validUntil: ISODate }
