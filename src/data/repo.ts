import { supabase } from './supabase'
import type { Cents, ISODate } from '@/types/domain'

/** Repositórios: único lugar que conversa com o banco. Convertem nomes do banco (pt) para o domínio. */

export type PaymentMethod = 'pix' | 'transferencia' | 'dinheiro'
export const METHOD_LABEL: Record<PaymentMethod, string> = { pix: 'Pix', transferencia: 'Transferência', dinheiro: 'Dinheiro' }

export interface StudentRow { id: string; name: string; guardianName: string | null; guardianContact: string | null; joinedAt: ISODate; status: 'ativo' | 'desistente' }
export interface PaymentRow { id: string; studentId: string; amount: Cents; paidAt: ISODate; method: PaymentMethod; note: string | null; reversalOf: string | null; createdAt: string }
export interface PublicSummary { raised: Cents; activeStudents: number; payments: number; updatedAt: string | null }

const db = () => {
  if (!supabase) throw new Error('Banco não configurado')
  return supabase
}

/** Mensagens do banco em português simples. */
function friendly(e: { message: string; code?: string }): Error {
  if (e.code === '42501' || /row-level security/i.test(e.message)) return new Error('Sem permissão. Entre com a conta de administrador.')
  if (e.code === '23505') return new Error('Esse lançamento já foi registrado.')
  return new Error(e.message)
}

export async function getPublicSummary(): Promise<PublicSummary> {
  const { data, error } = await db().rpc('resumo_publico').single<{ total_arrecadado: number; alunos_ativos: number; pagamentos: number; atualizado_em: string | null }>()
  if (error) throw friendly(error)
  return { raised: Number(data.total_arrecadado), activeStudents: Number(data.alunos_ativos), payments: Number(data.pagamentos), updatedAt: data.atualizado_em }
}

export async function listStudents(): Promise<StudentRow[]> {
  const { data, error } = await db().from('students').select('id,nome,responsavel_nome,responsavel_contato,adesao_em,status').order('nome')
  if (error) throw friendly(error)
  return data.map((r) => ({ id: r.id, name: r.nome, guardianName: r.responsavel_nome, guardianContact: r.responsavel_contato, joinedAt: r.adesao_em, status: r.status }))
}

export async function createStudent(s: { name: string; guardianName: string; guardianContact: string; joinedAt: ISODate }) {
  const { error } = await db().from('students').insert({
    nome: s.name.trim(), responsavel_nome: s.guardianName.trim() || null,
    responsavel_contato: s.guardianContact.trim() || null, adesao_em: s.joinedAt,
  })
  if (error) throw friendly(error)
}

export async function setStudentStatus(id: string, status: StudentRow['status']) {
  const { error } = await db().from('students').update({ status }).eq('id', id)
  if (error) throw friendly(error)
}

export async function listPayments(): Promise<PaymentRow[]> {
  const { data, error } = await db().from('payments')
    .select('id,student_id,valor,pago_em,metodo,observacao,estorno_de,registrado_em')
    .order('pago_em', { ascending: false }).order('registrado_em', { ascending: false })
  if (error) throw friendly(error)
  return data.map((r) => ({
    id: r.id, studentId: r.student_id, amount: Number(r.valor), paidAt: r.pago_em, method: r.metodo,
    note: r.observacao, reversalOf: r.estorno_de, createdAt: r.registrado_em,
  }))
}

/**
 * `idempotencyKey` é gerado quando o formulário abre: se o botão for clicado duas vezes
 * ou a internet cair no meio, o banco recusa a repetição.
 */
export async function createPayment(p: { studentId: string; amount: Cents; paidAt: ISODate; method: PaymentMethod; note: string; idempotencyKey: string }) {
  if (!Number.isSafeInteger(p.amount) || p.amount <= 0) throw new Error('Valor inválido')
  const { error } = await db().from('payments').insert({
    student_id: p.studentId, valor: p.amount, pago_em: p.paidAt, metodo: p.method,
    observacao: p.note.trim() || null, idempotency_key: p.idempotencyKey,
  })
  if (error) throw friendly(error)
}

/** Estorno: novo lançamento com valor oposto. O original nunca é alterado. */
export async function reversePayment(original: PaymentRow, reason: string, idempotencyKey: string) {
  const { error } = await db().from('payments').insert({
    student_id: original.studentId, valor: -original.amount, pago_em: new Date().toISOString().slice(0, 10),
    metodo: original.method, observacao: reason.trim() || 'Estorno', estorno_de: original.id, idempotency_key: idempotencyKey,
  })
  if (error) throw friendly(error)
}
