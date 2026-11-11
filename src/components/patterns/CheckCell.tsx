import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { AlertTriangle, BadgeCheck, CircleDashed } from 'lucide-react'
import { Badge, Button, Field, Input, Modal, Segmented } from '@/components/ui'
import { addCheck, type CheckRow, type CheckTable } from '@/data/checks'

const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/**
 * Situação de conferência de um lançamento (última conferência vale) com botão para conferir.
 * O histórico inteiro aparece no modal; nada é editado nem apagado.
 */
export function CheckCell({ table, recordId, history, names, canCheck, summary, onSaved }: {
  table: CheckTable; recordId: string; history: CheckRow[]; names: Map<string, string>; canCheck: boolean
  summary: ReactNode; onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const last = history.at(-1)
  const badge = !last ? <Badge><CircleDashed size={12} aria-hidden />A conferir</Badge>
    : last.status === 'conferido' ? <Badge tone="ok"><BadgeCheck size={12} aria-hidden />Conferido</Badge>
    : <Badge tone="bad"><AlertTriangle size={12} aria-hidden />Divergente</Badge>
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        title={last ? `${last.status === 'conferido' ? 'Conferido' : 'Divergente'} por ${names.get(last.by) ?? 'usuário'} em ${fmt(last.at)}` : 'Ainda não conferido'}>
        {badge}
      </button>
      <CheckModal open={open} onClose={() => setOpen(false)} table={table} recordId={recordId} history={history} names={names}
        canCheck={canCheck} summary={summary} onSaved={onSaved} />
    </>
  )
}

function CheckModal({ open, onClose, table, recordId, history, names, canCheck, summary, onSaved }: {
  open: boolean; onClose: () => void; table: CheckTable; recordId: string; history: CheckRow[]; names: Map<string, string>
  canCheck: boolean; summary: ReactNode; onSaved: () => void
}) {
  const [status, setStatus] = useState('Conferido')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (open) { setStatus('Conferido'); setNote(''); setError(null) } }, [open])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (status === 'Divergente' && note.trim().length < 3) { setError('Explique a divergência.'); return }
    setBusy(true); setError(null)
    try { await addCheck(table, recordId, status === 'Conferido' ? 'conferido' : 'divergente', note); onClose(); onSaved() }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Conferência" description={<>{summary} Confira com o extrato bancário ou o comprovante.</>}
      footer={canCheck ? <>
        {error && <p role="alert" className="mr-auto text-sm text-bad">{error}</p>}
        <Button variant="ghost" onClick={onClose}>Fechar</Button>
        <Button variant="primary" type="submit" form="check-form" loading={busy}>Registrar conferência</Button>
      </> : undefined}>
      {canCheck && (
        <form id="check-form" onSubmit={submit} className="space-y-4 mb-6">
          <Segmented label="Resultado" options={['Conferido', 'Divergente']} value={status} onChange={setStatus} />
          <Field label={status === 'Divergente' ? 'O que está diferente' : 'Observação (opcional)'}>
            {(id) => <Input id={id} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder={status === 'Divergente' ? 'Ex.: no extrato aparece R$ 90,00' : 'Ex.: conferido no extrato de março'} />}
          </Field>
        </form>
      )}
      <h3 className="text-[13px] font-semibold mb-2">Histórico</h3>
      {history.length ? (
        <ol className="space-y-3">
          {[...history].reverse().map((h) => (
            <li key={h.id} className="relative pl-5 border-l border-line text-sm">
              <span className={`absolute -left-[5px] top-1.5 size-2.5 rounded-full ${h.status === 'conferido' ? 'bg-ok' : 'bg-bad'}`} aria-hidden />
              <p className="font-medium">{h.status === 'conferido' ? 'Conferido' : 'Divergente'}</p>
              <p className="text-[13px] text-muted">{fmt(h.at)} · {names.get(h.by) ?? 'Usuário'}{h.note && <> · {h.note}</>}</p>
            </li>
          ))}
        </ol>
      ) : <p className="text-sm text-muted">Ainda não conferido.</p>}
    </Modal>
  )
}
