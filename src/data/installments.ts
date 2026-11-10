import { db, friendly, selectAll } from './db'
import type { InstallmentLike } from '@/lib/installments'

export type InstallmentRow = InstallmentLike

export async function listInstallments(): Promise<InstallmentRow[]> {
  const rows = await selectAll<{ id: string; student_id: string; numero: number; vencimento: string; valor: number; adicional_bp: number }>(
    (a, b) => db().from('installments').select('id,student_id,numero,vencimento,valor,adicional_bp').order('vencimento').order('numero').range(a, b))
  return rows.map((r) => ({ id: r.id, studentId: r.student_id, number: r.numero, dueDate: r.vencimento, amount: Number(r.valor), penaltyBp: r.adicional_bp }))
}

/** Gera/atualiza as parcelas pela configuração vigente. Só parcelas futuras sem pagamento mudam. */
export async function syncInstallments(): Promise<{ created: number; updated: number; removed: number }> {
  const { data, error } = await db().rpc('sincronizar_parcelas')
  if (error) throw friendly(error)
  const r = data as { criadas: number; atualizadas: number; removidas: number }
  return { created: r.criadas, updated: r.atualizadas, removed: r.removidas }
}
