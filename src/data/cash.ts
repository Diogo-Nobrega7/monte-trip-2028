import { db, friendly, selectAll } from './db'
import type { LedgerEntry, LedgerOrigin } from '@/lib/ledger'
import type { Cents, ISODate } from '@/types/domain'

/** Arrecadações, despesas, rendimentos e livro-caixa. Valores nunca são editados: correção = estorno. */

// ---------------------------------------------------------------- arrecadações
export type FundraisingKind = 'rifa' | 'venda' | 'evento' | 'doacao' | 'patrocinio'
export const KIND_LABEL: Record<FundraisingKind, string> = { rifa: 'Rifa', venda: 'Venda', evento: 'Evento', doacao: 'Doação', patrocinio: 'Patrocínio' }

export interface FundraisingEntry { id: string; fundraisingId: string; type: 'receita' | 'custo'; amount: Cents; date: ISODate; description: string | null; reversalOf: string | null; createdAt: string }
export interface FundraisingRow { id: string; title: string; kind: FundraisingKind; date: ISODate; responsible: string | null; notes: string | null; entries: FundraisingEntry[] }

export async function listFundraisings(): Promise<FundraisingRow[]> {
  const [actions, entries] = await Promise.all([
    selectAll<{ id: string; titulo: string; tipo: FundraisingKind; data: string; responsavel: string | null; observacoes: string | null }>(
      (a, b) => db().from('fundraisings').select('id,titulo,tipo,data,responsavel,observacoes').order('data', { ascending: false }).range(a, b)),
    selectAll<{ id: string; fundraising_id: string; tipo: 'receita' | 'custo'; valor: number; data: string; descricao: string | null; estorno_de: string | null; registrado_em: string }>(
      (a, b) => db().from('fundraising_entries').select('id,fundraising_id,tipo,valor,data,descricao,estorno_de,registrado_em').order('registrado_em').range(a, b)),
  ])
  const by = new Map<string, FundraisingEntry[]>()
  for (const e of entries) {
    const x: FundraisingEntry = { id: e.id, fundraisingId: e.fundraising_id, type: e.tipo, amount: Number(e.valor), date: e.data, description: e.descricao, reversalOf: e.estorno_de, createdAt: e.registrado_em }
    by.set(x.fundraisingId, [...(by.get(x.fundraisingId) ?? []), x])
  }
  return actions.map((a) => ({ id: a.id, title: a.titulo, kind: a.tipo, date: a.data, responsible: a.responsavel, notes: a.observacoes, entries: by.get(a.id) ?? [] }))
}

/** Receita, custos e líquido de uma ação (estornos já com sinal trocado). */
export function fundraisingTotals(entries: FundraisingEntry[]) {
  const gross = entries.filter((e) => e.type === 'receita').reduce((s, e) => s + e.amount, 0)
  const costs = entries.filter((e) => e.type === 'custo').reduce((s, e) => s + e.amount, 0)
  return { gross, costs, net: gross - costs }
}

export interface FundraisingInput { title: string; kind: FundraisingKind; date: ISODate; responsible: string; notes: string }

export async function createFundraising(f: FundraisingInput & { gross: Cents; costs: Cents; idempotencyKey: string }) {
  const { error } = await db().rpc('registrar_arrecadacao', {
    p_titulo: f.title, p_tipo: f.kind, p_data: f.date, p_responsavel: f.responsible, p_observacoes: f.notes,
    p_receita: f.gross, p_custos: f.costs, p_chave: f.idempotencyKey,
  })
  if (error) throw friendly(error)
}

/** Corrige só dados descritivos da ação. */
export async function updateFundraising(id: string, f: FundraisingInput) {
  const { error } = await db().from('fundraisings').update({
    titulo: f.title.trim(), tipo: f.kind, data: f.date, responsavel: f.responsible.trim() || null, observacoes: f.notes.trim() || null,
  }).eq('id', id)
  if (error) throw friendly(error)
}

export async function addFundraisingEntry(e: { fundraisingId: string; type: 'receita' | 'custo'; amount: Cents; date: ISODate; description: string; idempotencyKey: string }) {
  const { error } = await db().from('fundraising_entries').insert({
    fundraising_id: e.fundraisingId, tipo: e.type, valor: e.amount, data: e.date, descricao: e.description.trim() || null, idempotency_key: e.idempotencyKey,
  })
  if (error) throw friendly(error)
}

export async function reverseFundraisingEntry(o: FundraisingEntry, reason: string, idempotencyKey: string, today: ISODate) {
  const { error } = await db().from('fundraising_entries').insert({
    fundraising_id: o.fundraisingId, tipo: o.type, valor: -o.amount, data: today, descricao: `Estorno: ${reason.trim()}`.slice(0, 300),
    estorno_de: o.id, idempotency_key: idempotencyKey,
  })
  if (error) throw friendly(error)
}

// ---------------------------------------------------------------- despesas
export type ExpenseCategory = 'agencia' | 'transporte' | 'hospedagem' | 'ingressos' | 'materiais' | 'taxas' | 'devolucao' | 'outros'
export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  agencia: 'Agência', transporte: 'Transporte', hospedagem: 'Hospedagem', ingressos: 'Ingressos',
  materiais: 'Materiais', taxas: 'Taxas bancárias', devolucao: 'Devolução a desistente', outros: 'Outros',
}
export interface ExpenseRow { id: string; description: string; category: ExpenseCategory; date: ISODate; amount: Cents; justification: string; reversalOf: string | null; createdAt: string }

export async function listExpenses(): Promise<ExpenseRow[]> {
  const rows = await selectAll<{ id: string; descricao: string; categoria: ExpenseCategory; data: string; valor: number; justificativa: string; estorno_de: string | null; registrado_em: string }>(
    (a, b) => db().from('expenses').select('id,descricao,categoria,data,valor,justificativa,estorno_de,registrado_em').order('data', { ascending: false }).order('registrado_em', { ascending: false }).range(a, b))
  return rows.map((r) => ({ id: r.id, description: r.descricao, category: r.categoria, date: r.data, amount: Number(r.valor), justification: r.justificativa, reversalOf: r.estorno_de, createdAt: r.registrado_em }))
}

/** Grava a despesa e devolve o id (para anexar o comprovante em seguida). */
export async function createExpense(e: { description: string; category: ExpenseCategory; date: ISODate; amount: Cents; justification: string; idempotencyKey: string }): Promise<string> {
  const { data, error } = await db().from('expenses').insert({
    descricao: e.description.trim(), categoria: e.category, data: e.date, valor: e.amount, justificativa: e.justification.trim(), idempotency_key: e.idempotencyKey,
  }).select('id').single()
  if (error) throw friendly(error)
  return data.id as string
}

export async function updateExpenseText(id: string, description: string, justification: string) {
  const { error } = await db().from('expenses').update({ descricao: description.trim(), justificativa: justification.trim() }).eq('id', id)
  if (error) throw friendly(error)
}

export async function reverseExpense(o: ExpenseRow, reason: string, idempotencyKey: string, today: ISODate) {
  const { error } = await db().from('expenses').insert({
    descricao: o.description, categoria: o.category, data: today, valor: -o.amount, justificativa: `Estorno: ${reason.trim()}`.slice(0, 1000),
    estorno_de: o.id, idempotency_key: idempotencyKey,
  })
  if (error) throw friendly(error)
}

// ---------------------------------------------------------------- rendimentos
export interface YieldRow { id: string; date: ISODate; amount: Cents; institution: string | null; description: string | null; reversalOf: string | null }

export async function listYields(): Promise<YieldRow[]> {
  const rows = await selectAll<{ id: string; data: string; valor: number; instituicao: string | null; descricao: string | null; estorno_de: string | null }>(
    (a, b) => db().from('yields').select('id,data,valor,instituicao,descricao,estorno_de').order('data', { ascending: false }).range(a, b))
  return rows.map((r) => ({ id: r.id, date: r.data, amount: Number(r.valor), institution: r.instituicao, description: r.descricao, reversalOf: r.estorno_de }))
}

export async function createYield(y: { date: ISODate; amount: Cents; institution: string; description: string; idempotencyKey: string }) {
  const { error } = await db().from('yields').insert({
    data: y.date, valor: y.amount, instituicao: y.institution.trim() || null, descricao: y.description.trim() || null, idempotency_key: y.idempotencyKey,
  })
  if (error) throw friendly(error)
}

export async function reverseYield(o: YieldRow, reason: string, idempotencyKey: string, today: ISODate) {
  const { error } = await db().from('yields').insert({
    data: today, valor: -o.amount, instituicao: o.institution, descricao: `Estorno: ${reason.trim()}`.slice(0, 300), estorno_de: o.id, idempotency_key: idempotencyKey,
  })
  if (error) throw friendly(error)
}

// ---------------------------------------------------------------- livro-caixa
export async function listLedger(): Promise<(LedgerEntry & { reference: string | null; createdAt: string })[]> {
  const rows = await selectAll<{ origem: LedgerOrigin; id: string; data: string; valor: number; estorno: boolean; referencia: string | null; descricao: string | null; registrado_em: string }>(
    (a, b) => db().from('livro_caixa').select('origem,id,data,valor,estorno,referencia,descricao,registrado_em').order('data').order('registrado_em').range(a, b))
  return rows.map((r) => ({ origin: r.origem, id: r.id, date: r.data, amount: Number(r.valor), reversal: r.estorno, description: r.descricao, reference: r.referencia, createdAt: r.registrado_em }))
}
