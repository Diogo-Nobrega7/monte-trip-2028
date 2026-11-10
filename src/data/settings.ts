import { db, friendly } from './db'
import { fromDb, toDb, type DbSettings } from '@/lib/settings'
import type { ProjectSettings } from '@/types/domain'

export interface CurrentSettings { settings: ProjectSettings; version: number; changedAt: string }
export interface SettingsVersion {
  id: number; changes: Record<string, { de: unknown; para: unknown }>; reason: string | null
  changedBy: string | null; changedAt: string; approvedBy: string | null; approvedAt: string | null; proposalId: number | null
}
export interface SettingsProposal {
  id: number; baseVersion: number; changes: Record<string, { de: unknown; para: unknown }>; reason: string
  status: 'pendente' | 'aprovada' | 'rejeitada' | 'cancelada'; proposedBy: string; proposedAt: string
  decidedBy: string | null; decidedAt: string | null; decisionNote: string | null
}

export async function getCurrentSettings(): Promise<CurrentSettings> {
  const { data, error } = await db().rpc('configuracao_vigente')
  if (error) throw friendly(error)
  if (!data) throw new Error('Configuração não encontrada. Rode as migrações do banco (docs/PUBLICAR.md).')
  const { _versao, _alterado_em, ...v } = data as DbSettings & { _versao: number; _alterado_em: string }
  return { settings: fromDb(v as DbSettings), version: _versao, changedAt: _alterado_em }
}

/** Gerais entram na hora; regras financeiras viram proposta para o professor. */
export async function proposeSettings(s: ProjectSettings, reason: string): Promise<{ version: number | null; proposal: number | null }> {
  const { data, error } = await db().rpc('propor_configuracoes', { p_valores: toDb(s), p_motivo: reason })
  if (error) throw friendly(error)
  const r = data as { versao: number | null; proposta: number | null }
  return { version: r.versao, proposal: r.proposta }
}

export async function listVersions(): Promise<SettingsVersion[]> {
  const { data, error } = await db().from('config_versions')
    .select('id,alteracoes,motivo,alterado_por,alterado_em,aprovado_por,aprovado_em,proposta_id').order('id', { ascending: false }).limit(200)
  if (error) throw friendly(error)
  return data.map((r) => ({
    id: r.id, changes: r.alteracoes, reason: r.motivo, changedBy: r.alterado_por, changedAt: r.alterado_em,
    approvedBy: r.aprovado_por, approvedAt: r.aprovado_em, proposalId: r.proposta_id,
  }))
}

export async function listProposals(): Promise<SettingsProposal[]> {
  const { data, error } = await db().from('config_proposals')
    .select('id,base_versao,alteracoes,motivo,status,proposto_por,proposto_em,decidido_por,decidido_em,observacao_decisao').order('id', { ascending: false }).limit(200)
  if (error) throw friendly(error)
  return data.map((r) => ({
    id: r.id, baseVersion: r.base_versao, changes: r.alteracoes, reason: r.motivo, status: r.status, proposedBy: r.proposto_por,
    proposedAt: r.proposto_em, decidedBy: r.decidido_por, decidedAt: r.decidido_em, decisionNote: r.observacao_decisao,
  }))
}

export async function decideProposal(id: number, approve: boolean, note: string) {
  const { error } = await db().rpc('decidir_proposta', { p_id: id, p_aprovar: approve, p_observacao: note || null })
  if (error) throw friendly(error)
}

export async function cancelProposal(id: number) {
  const { error } = await db().rpc('cancelar_proposta', { p_id: id })
  if (error) throw friendly(error)
}

/** Nomes das pessoas (perfis) para mostrar no histórico. Admin e supervisor leem todos. */
export async function listProfileNames(): Promise<Map<string, string>> {
  const { data, error } = await db().from('profiles').select('id,nome')
  if (error) throw friendly(error)
  return new Map(data.map((p) => [p.id as string, p.nome as string]))
}
