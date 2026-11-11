import { db, selectAll } from './db'

/**
 * Cópia de segurança: todas as tabelas do projeto num arquivo JSON, como estão no banco.
 * Só quem pode ler tudo (admin e supervisor) consegue gerar; o RLS garante.
 * Arquivos do Storage não entram (são binários): baixe pela página Documentos se precisar.
 * Restauração: docs/BACKUP.md e scripts/restaurar-backup.mjs.
 */
export const BACKUP_TABLES = [
  'profiles', 'config_versions', 'config_proposals', 'students', 'installments', 'payments',
  'fundraisings', 'fundraising_entries', 'expenses', 'yields', 'agencies', 'proposals', 'documents', 'conferencias', 'saldos_bancarios', 'audit_log',
] as const

export interface Backup { formato: 'monte-trip-2028/backup'; versao: 1; gerado_em: string; tabelas: Record<string, unknown[]> }

export async function exportBackup(): Promise<Backup> {
  const tabelas: Record<string, unknown[]> = {}
  for (const t of BACKUP_TABLES) {
    // ordem estável: ids crescentes quando existem; audit_log e configs têm id numérico
    try { tabelas[t] = await selectAll((a, b) => db().from(t).select('*').order('id').range(a, b)) }
    catch (e) {
      // tabelas da migração 0008 podem ainda não existir
      if ((t === 'conferencias' || t === 'saldos_bancarios') && /schema cache|does not exist/i.test((e as Error).message)) tabelas[t] = []
      else throw e
    }
  }
  return { formato: 'monte-trip-2028/backup', versao: 1, gerado_em: new Date().toISOString(), tabelas }
}

export function downloadFile(name: string, content: string | Blob, type = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
