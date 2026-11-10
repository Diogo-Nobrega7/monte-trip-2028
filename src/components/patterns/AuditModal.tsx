import { History } from 'lucide-react'
import { EmptyState, Modal } from '@/components/ui'
import { auditFor, type AuditEntry } from '@/data/audit'
import { listProfileNames } from '@/data/settings'
import { useRemote } from '@/data/useRemote'

const ACTION: Record<AuditEntry['action'], string> = { INSERT: 'Cadastro', UPDATE: 'Alteração', DELETE: 'Remoção' }
// campos técnicos que não interessam a quem lê o histórico
const HIDDEN = new Set(['id', 'criado_em', 'criado_por', 'atualizado_em', 'registrado_em', 'registrado_por', 'idempotency_key'])

const show = (v: unknown) => v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)

/** Histórico de alterações de um registro, lido do audit_log (gravado pelo banco, ninguém edita). */
export function AuditModal({ table, id, title, labels = {}, onClose }: {
  table: string; id: string | null; title: string; labels?: Record<string, string>; onClose: () => void
}) {
  const entries = useRemote(() => (id ? auditFor(table, id) : Promise.resolve([])), !!id, [], id ?? '')
  const names = useRemote(listProfileNames, !!id, new Map<string, string>())
  return (
    <Modal wide open={!!id} onClose={onClose} title={title} description="Quem mudou, quando e o que mudou. Registrado automaticamente pelo banco.">
      {entries.loading ? <p className="text-sm text-muted py-6">Carregando…</p>
        : entries.error ? <p role="alert" className="text-sm text-bad py-6">{entries.error}</p>
        : !entries.data.length ? <EmptyState icon={History} title="Sem histórico">Nenhuma alteração registrada.</EmptyState>
        : <ol className="space-y-4">
          {entries.data.map((e) => {
            const fields = e.action === 'UPDATE'
              ? Object.keys(e.after ?? {}).filter((k) => !HIDDEN.has(k) && JSON.stringify(e.before?.[k]) !== JSON.stringify(e.after?.[k]))
              : []
            return (
              <li key={e.id} className="relative pl-5 border-l border-line">
                <span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-accent" aria-hidden />
                <p className="text-sm font-medium">{ACTION[e.action]}</p>
                <p className="text-[13px] text-muted">{new Date(e.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {e.user ? names.data.get(e.user) ?? 'Usuário' : 'Sistema'}</p>
                {fields.length > 0 && <ul className="mt-1.5 space-y-1 text-[13px] num break-words">
                  {fields.map((k) => <li key={k}><span className="text-muted">{labels[k] ?? k}:</span> {show(e.before?.[k])} → <b className="font-medium">{show(e.after?.[k])}</b></li>)}
                </ul>}
              </li>
            )
          })}
        </ol>}
    </Modal>
  )
}
