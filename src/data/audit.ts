import { db, friendly } from './db'

export interface AuditEntry { id: number; action: 'INSERT' | 'UPDATE' | 'DELETE'; before: Record<string, unknown> | null; after: Record<string, unknown> | null; user: string | null; at: string }

/** Histórico de alterações de um registro (gravado por gatilho no banco; ninguém edita). */
export async function auditFor(table: string, id: string): Promise<AuditEntry[]> {
  const { data, error } = await db().from('audit_log').select('id,acao,antes,depois,usuario,em')
    .eq('tabela', table).eq('registro_id', id).order('id', { ascending: false }).limit(100)
  if (error) throw friendly(error)
  return data.map((r) => ({ id: r.id, action: r.acao, before: r.antes, after: r.depois, user: r.usuario, at: r.em }))
}
