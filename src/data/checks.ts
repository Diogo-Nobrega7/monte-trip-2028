import { db, friendly, selectAll } from './db'
import type { LedgerOrigin } from '@/lib/ledger'
import type { Cents, ISODate } from '@/types/domain'

/**
 * Conferência de lançamentos e saldo bancário informado (migração 0008).
 * Se a migração ainda não rodou no Supabase, as listas voltam vazias com `available: false`
 * e a tela esconde os botões, em vez de quebrar.
 */
export type CheckTable = 'payments' | 'expenses' | 'fundraising_entries' | 'yields'
export interface CheckRow { id: number; table: CheckTable; recordId: string; status: 'conferido' | 'divergente'; note: string | null; by: string; at: string }

const missing = (e: { code?: string; message: string }) => e.code === 'PGRST205' || e.code === '42P01' || /does not exist|schema cache/i.test(e.message)

export async function listChecks(): Promise<{ available: boolean; rows: CheckRow[] }> {
  try {
    const rows = await selectAll<{ id: number; tabela: CheckTable; registro_id: string; situacao: CheckRow['status']; observacao: string | null; conferido_por: string; conferido_em: string }>(
      (a, b) => db().from('conferencias').select('id,tabela,registro_id,situacao,observacao,conferido_por,conferido_em').order('id').range(a, b))
    return { available: true, rows: rows.map((r) => ({ id: r.id, table: r.tabela, recordId: r.registro_id, status: r.situacao, note: r.observacao, by: r.conferido_por, at: r.conferido_em })) }
  } catch (e) {
    if (missing(e as { message: string })) return { available: false, rows: [] }
    throw e
  }
}

/** Situação atual (última conferência) de cada lançamento: chave `${tabela}:${id}`. */
export function latestChecks(rows: CheckRow[]): Map<string, CheckRow> {
  const m = new Map<string, CheckRow>()
  for (const r of rows) m.set(`${r.table}:${r.recordId}`, r) // rows em ordem de id: a última vence
  return m
}

/** Mesma chave usada pelo livro-caixa (`origem:id`) para saber o que já foi conferido. */
export function checkedLedgerKeys(rows: CheckRow[]): Set<string> {
  const origin: Record<CheckTable, LedgerOrigin[]> = {
    payments: ['mensalidade'], expenses: ['despesa'], fundraising_entries: ['arrecadacao', 'custo_arrecadacao'], yields: ['rendimento'],
  }
  const out = new Set<string>()
  for (const r of latestChecks(rows).values()) if (r.status === 'conferido') for (const o of origin[r.table]) out.add(`${o}:${r.recordId}`)
  return out
}

export async function addCheck(table: CheckTable, recordId: string, status: CheckRow['status'], note: string) {
  const { data: u } = await db().auth.getUser()
  const { error } = await db().from('conferencias').insert({ tabela: table, registro_id: recordId, situacao: status, observacao: note.trim() || null, conferido_por: u.user?.id })
  if (error) throw friendly(error)
}

export interface BankBalance { id: string; date: ISODate; amount: Cents; institution: string | null; note: string | null; createdAt: string }

export async function listBankBalances(): Promise<{ available: boolean; rows: BankBalance[] }> {
  const { data, error } = await db().from('saldos_bancarios').select('id,data,valor,instituicao,observacao,registrado_em')
    .order('data', { ascending: false }).order('registrado_em', { ascending: false }).limit(100)
  if (error) { if (missing(error)) return { available: false, rows: [] }; throw friendly(error) }
  return { available: true, rows: data.map((r) => ({ id: r.id, date: r.data, amount: Number(r.valor), institution: r.instituicao, note: r.observacao, createdAt: r.registrado_em })) }
}

export async function addBankBalance(b: { date: ISODate; amount: Cents; institution: string; note: string }) {
  const { error } = await db().from('saldos_bancarios').insert({ data: b.date, valor: b.amount, instituicao: b.institution.trim() || null, observacao: b.note.trim() || null })
  if (error) throw friendly(error)
}
