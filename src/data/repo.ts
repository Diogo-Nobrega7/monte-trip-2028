import { db, friendly, selectAll } from './db'
import type { Cents, ISODate } from '@/types/domain'

/** Alunos, pagamentos e totais públicos. Convertem nomes do banco (pt) para o domínio. */

export type PaymentMethod = 'pix' | 'transferencia' | 'dinheiro'
export const METHOD_LABEL: Record<PaymentMethod, string> = { pix: 'Pix', transferencia: 'Transferência', dinheiro: 'Dinheiro' }

export interface StudentRow { id: string; name: string; guardianName: string | null; guardianContact: string | null; joinedAt: ISODate; status: 'ativo' | 'desistente' }
export interface PaymentRow {
  id: string; studentId: string; installmentId: string | null; amount: Cents; paidAt: ISODate; method: PaymentMethod
  note: string | null; reversalOf: string | null; createdAt: string
}
export interface PublicSummary {
  raised: Cents; activeStudents: number; payments: number; updatedAt: string | null
  fundraisingNet: Cents; expenses: Cents; yields: Cents; balance: Cents
}
export interface PublicMonth { month: string; inflow: Cents; outflow: Cents; yields: Cents }

export async function getPublicSummary(): Promise<PublicSummary> {
  const { data, error } = await db().rpc('resumo_publico').single<Record<string, number | string | null>>()
  if (error) throw friendly(error)
  const n = (k: string) => Number(data[k] ?? 0)
  return {
    raised: n('total_arrecadado'), activeStudents: n('alunos_ativos'), payments: n('pagamentos'), updatedAt: (data.atualizado_em as string) ?? null,
    fundraisingNet: n('arrecadacoes_liquido'), expenses: n('despesas'), yields: n('rendimentos'),
    // banco antigo (só 0001) não tem "saldo": cai no total de mensalidades
    balance: data.saldo === undefined ? n('total_arrecadado') : n('saldo'),
  }
}

export async function getPublicMonthly(): Promise<PublicMonth[]> {
  const { data, error } = await db().rpc('resumo_publico_mensal')
  if (error) throw friendly(error)
  return (data as { mes: string; entradas: number; saidas: number; rendimentos: number }[])
    .map((r) => ({ month: r.mes, inflow: Number(r.entradas), outflow: Number(r.saidas), yields: Number(r.rendimentos) }))
}

const studentCols = 'id,nome,responsavel_nome,responsavel_contato,adesao_em,status'
type StudentDb = { id: string; nome: string; responsavel_nome: string | null; responsavel_contato: string | null; adesao_em: string; status: StudentRow['status'] }
const toStudent = (r: StudentDb): StudentRow => ({ id: r.id, name: r.nome, guardianName: r.responsavel_nome, guardianContact: r.responsavel_contato, joinedAt: r.adesao_em, status: r.status })

export async function listStudents(): Promise<StudentRow[]> {
  const rows = await selectAll<StudentDb>((a, b) => db().from('students').select(studentCols).order('nome').range(a, b))
  return rows.map(toStudent)
}

export interface StudentInput { name: string; guardianName: string; guardianContact: string; joinedAt: ISODate }
const studentToDb = (s: StudentInput) => ({
  nome: s.name.trim(), responsavel_nome: s.guardianName.trim() || null,
  responsavel_contato: s.guardianContact.trim() || null, adesao_em: s.joinedAt,
})

export async function createStudent(s: StudentInput) {
  const { error } = await db().from('students').insert(studentToDb(s))
  if (error) throw friendly(error)
}

/** Vários alunos numa operação só: ou entram todos, ou nenhum. */
export async function createStudents(list: StudentInput[]) {
  const { error } = await db().from('students').insert(list.map(studentToDb))
  if (error) throw friendly(error)
}

/** Corrige dados cadastrais (não financeiros). Fica na auditoria. */
export async function updateStudent(id: string, s: StudentInput) {
  const { error } = await db().from('students').update(studentToDb(s)).eq('id', id)
  if (error) throw friendly(error)
}

export async function setStudentStatus(id: string, status: StudentRow['status']) {
  const { error } = await db().from('students').update({ status }).eq('id', id)
  if (error) throw friendly(error)
}

type PaymentDb = { id: string; student_id: string; installment_id: string | null; valor: number; pago_em: string; metodo: PaymentMethod; observacao: string | null; estorno_de: string | null; registrado_em: string }
export async function listPayments(): Promise<PaymentRow[]> {
  const rows = await selectAll<PaymentDb>((a, b) => db().from('payments')
    .select('id,student_id,installment_id,valor,pago_em,metodo,observacao,estorno_de,registrado_em')
    .order('pago_em', { ascending: false }).order('registrado_em', { ascending: false }).range(a, b))
  return rows.map((r) => ({
    id: r.id, studentId: r.student_id, installmentId: r.installment_id, amount: Number(r.valor), paidAt: r.pago_em,
    method: r.metodo, note: r.observacao, reversalOf: r.estorno_de, createdAt: r.registrado_em,
  }))
}

/**
 * `idempotencyKey` é gerado quando o formulário abre: se o botão for clicado duas vezes
 * ou a internet cair no meio, o banco recusa a repetição.
 */
export async function createPayment(p: { studentId: string; installmentId: string | null; amount: Cents; paidAt: ISODate; method: PaymentMethod; note: string; idempotencyKey: string }) {
  if (!Number.isSafeInteger(p.amount) || p.amount <= 0) throw new Error('Valor inválido')
  const { error } = await db().from('payments').insert({
    student_id: p.studentId, installment_id: p.installmentId, valor: p.amount, pago_em: p.paidAt, metodo: p.method,
    observacao: p.note.trim() || null, idempotency_key: p.idempotencyKey,
  })
  if (error) throw friendly(error)
}

/** Divide o valor nas parcelas em aberto (mais antiga primeiro), tudo numa transação no banco. */
export async function createDistributedPayment(p: { studentId: string; amount: Cents; paidAt: ISODate; method: PaymentMethod; note: string; idempotencyKey: string }): Promise<number> {
  if (!Number.isSafeInteger(p.amount) || p.amount <= 0) throw new Error('Valor inválido')
  const { data, error } = await db().rpc('registrar_pagamento_distribuido', {
    p_student: p.studentId, p_valor: p.amount, p_pago_em: p.paidAt, p_metodo: p.method, p_observacao: p.note, p_chave: p.idempotencyKey,
  })
  if (error) throw friendly(error)
  return Number(data)
}

/** Estorno: novo lançamento com valor oposto. O original nunca é alterado. */
export async function reversePayment(original: PaymentRow, reason: string, idempotencyKey: string, today: ISODate) {
  const { error } = await db().from('payments').insert({
    student_id: original.studentId, installment_id: original.installmentId, valor: -original.amount, pago_em: today,
    metodo: original.method, observacao: reason.trim() || 'Estorno', estorno_de: original.id, idempotency_key: idempotencyKey,
  })
  if (error) throw friendly(error)
}
