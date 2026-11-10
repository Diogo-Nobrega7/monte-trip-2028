import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Button, Field, Input, Modal } from '@/components/ui'
import { newKey } from '@/data/useRemote'

/**
 * Estorno de qualquer lançamento: pede o motivo e grava um lançamento oposto.
 * O original nunca é alterado. A chave de idempotência nasce ao abrir: clique duplo não estorna duas vezes.
 */
export function ReverseModal({ open, title = 'Estornar lançamento', summary, onClose, onConfirm }: {
  open: boolean; title?: string; summary: ReactNode; onClose: () => void
  onConfirm: (reason: string, idempotencyKey: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [key, setKey] = useState(newKey)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (open) { setKey(newKey()); setReason(''); setError(null) } }, [open])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (reason.trim().length < 3) { setError('Explique o motivo do estorno.'); return }
    setBusy(true); setError(null)
    try { await onConfirm(reason, key); onClose() }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}
      description={<>{summary} O lançamento original continua no histórico; o estorno lança o valor oposto.</>}
      footer={<>
        {error && <p role="alert" className="mr-auto text-sm text-bad">{error}</p>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" type="submit" form="reverse-form" loading={busy}>Confirmar estorno</Button>
      </>}>
      <form id="reverse-form" onSubmit={submit}>
        <Field label="Motivo" hint="Ex.: valor digitado errado, lançado em duplicidade">
          {(id) => <Input id={id} required maxLength={250} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
      </form>
    </Modal>
  )
}
