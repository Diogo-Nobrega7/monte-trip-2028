import { useEffect, useState } from 'react'
import { Paperclip } from 'lucide-react'
import { Button, Field, Input, Modal } from '@/components/ui'
import { ACCEPT, checkFile, formatBytes, uploadDocument, type DocCategory, type DocLink } from '@/data/documents'

/**
 * Anexa um arquivo (PDF ou imagem, até 10 MB) a um registro: comprovante de despesa ou de ação,
 * PDF de proposta. O arquivo vai para o Storage privado; só a gestão vê.
 */
export function AttachModal({ open, title, category, link, defaultTitle, onClose, onSaved }: {
  open: boolean; title: string; category: DocCategory; link: DocLink; defaultTitle: string; onClose: () => void; onSaved: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (open) { setFile(null); setName(defaultTitle); setError(null) } }, [open, defaultTitle])

  async function save() {
    if (!file) { setError('Escolha o arquivo.'); return }
    if (name.trim().length < 2) { setError('Dê um título ao arquivo.'); return }
    setBusy(true); setError(null)
    try { await uploadDocument(file, { category, title: name, visibility: 'gestao', ...link }); onClose(); onSaved() }
    catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={title} description="PDF, JPG, PNG ou WEBP, até 10 MB. Visível só para a administração e o professor."
      footer={<>
        {error && <p role="alert" className="mr-auto text-sm text-bad">{error}</p>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={busy} onClick={() => void save()}>Enviar</Button>
      </>}>
      <div className="space-y-4">
        <FilePicker file={file} onPick={(f) => { setError(f ? checkFile(f) : null); setFile(f) }} />
        <Field label="Título">{(id) => <Input id={id} maxLength={160} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
      </div>
    </Modal>
  )
}

export function FilePicker({ file, onPick }: { file: File | null; onPick: (f: File | null) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-md border border-dashed border-line px-4 py-4 cursor-pointer hover:bg-raised">
      <Paperclip size={18} className="text-accent shrink-0" aria-hidden />
      <span className="text-sm flex-1 min-w-0 truncate">{file ? `${file.name} (${formatBytes(file.size)})` : 'Escolher arquivo'}</span>
      <input type="file" accept={ACCEPT} className="sr-only" onChange={(e) => { onPick(e.target.files?.[0] ?? null); e.target.value = '' }} />
    </label>
  )
}
