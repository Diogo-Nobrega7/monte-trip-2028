import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Download, Eye, FileBarChart, FileCheck, FileSignature, FileText, FolderOpen, Globe, Lock, ReceiptText, ScrollText, Trash2, Upload, type LucideIcon } from 'lucide-react'
import { PageHeader, StageNotice, Badge, Button, Card, Field, Input, Modal, Select, useToast, type Column } from '@/components/ui'
import { TableCard } from '@/components/patterns/TableCard'
import { FilePicker } from '@/components/patterns/AttachModal'
import { useAuth } from '@/data/auth'
import { connected } from '@/data/supabase'
import {
  DOC_CATEGORY_LABEL, PUBLIC_ALLOWED, checkFile, deleteDocument, documentUrl, formatBytes, listDocuments, openDocument, uploadDocument,
  type DocCategory, type DocumentRow,
} from '@/data/documents'
import { listStudents } from '@/data/repo'
import { listProfileNames } from '@/data/settings'
import { dateBR, useRemote } from '@/data/useRemote'

const ICON: Record<DocCategory, LucideIcon> = {
  regulamento: ScrollText, autorizacao: FileSignature, contrato: FileCheck, comprovante: ReceiptText,
  relatorio: FileBarChart, proposta: FolderOpen, outro: FileText,
}
const HINT: Record<DocCategory, string> = {
  regulamento: 'Regras de adesão, pagamento, atraso e desistência.',
  autorizacao: 'Autorização dos responsáveis para cada aluno menor de idade.',
  contrato: 'Contrato com a agência e termos assinados.',
  comprovante: 'Comprovantes de pagamentos, despesas e ações.',
  relatorio: 'Prestações de contas periódicas e final.',
  proposta: 'Propostas recebidas das agências.',
  outro: 'Outros arquivos do projeto.',
}

/** Arquivos oficiais no Storage privado. Visitante vê só regulamento e relatórios marcados como públicos. */
export function DocumentsPage() {
  const { canReadAll, isAdmin } = useAuth()
  const toast = useToast()
  const docs = useRemote(listDocuments, connected, [])
  const names = useRemote(listProfileNames, connected && canReadAll, new Map<string, string>())
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<DocumentRow | null>(null)

  const active = docs.data.filter((d) => !d.deletedAt)
  const count = (c: DocCategory) => active.filter((d) => d.category === c).length

  async function open(d: DocumentRow, download = false) {
    try {
      if (download) { const url = await documentUrl(d.path, d.originalName ?? `${d.title}`); window.location.href = url }
      else await openDocument(d.path)
    } catch (e) { toast((e as Error).message, 'error') }
  }

  const columns: Column<DocumentRow>[] = [
    { key: 'title', header: 'Documento', primary: true, render: (d) => (
      <span className="flex items-center gap-3 min-w-0">
        {(() => { const I = ICON[d.category]; return <span className="grid place-items-center size-8 rounded-md bg-accent/10 text-accent shrink-0"><I size={16} aria-hidden /></span> })()}
        <span className="min-w-0"><span className={`font-medium block truncate ${d.deletedAt ? 'line-through text-muted' : ''}`}>{d.title}</span>
          <span className="block text-xs text-faint truncate">{d.originalName} · {formatBytes(d.size)}</span></span>
      </span>
    ) },
    { key: 'cat', header: 'Categoria', render: (d) => <Badge>{DOC_CATEGORY_LABEL[d.category]}</Badge> },
    { key: 'vis', header: 'Acesso', hideOnMobile: true, render: (d) => d.visibility === 'publico'
      ? <span className="inline-flex items-center gap-1.5 text-[13px] text-muted"><Globe size={13} aria-hidden />Público</span>
      : <span className="inline-flex items-center gap-1.5 text-[13px] text-muted"><Lock size={13} aria-hidden />Gestão</span> },
    { key: 'by', header: 'Enviado', hideOnMobile: true, render: (d) => <span className="text-[13px]">{dateBR(d.uploadedAt)}{canReadAll && <span className="text-faint"> · {names.data.get(d.uploadedBy) ?? 'Usuário'}</span>}</span> },
    { key: 'act', header: 'Ações', render: (d) => d.deletedAt
      ? <span className="text-[13px] text-muted">Excluído em {dateBR(d.deletedAt)}: {d.deleteReason}</span>
      : <span className="inline-flex gap-1">
          <Button size="sm" variant="ghost" icon={Eye} onClick={() => void open(d)}>Ver</Button>
          <Button size="sm" variant="ghost" icon={Download} aria-label={`Baixar ${d.title}`} onClick={() => void open(d, true)} />
          {isAdmin && <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Excluir ${d.title}`} onClick={() => setDeleting(d)} />}
        </span> },
  ]

  const filters = ['Todos', ...(Object.values(DOC_CATEGORY_LABEL)), ...(canReadAll ? ['Excluídos'] : [])]
  return (
    <>
      <PageHeader icon={FileText} section="Organização" title="Documentos" description="Arquivos oficiais do projeto, com acesso definido por tipo de documento."
        actions={isAdmin ? <Button variant="primary" icon={Upload} onClick={() => setUploading(true)}>Enviar arquivo</Button> : undefined} />
      {!connected ? <StageNotice>Modo demonstração: o banco ainda não foi conectado, então não há arquivos.</StageNotice>
        : !canReadAll && <StageNotice>Você está vendo só os documentos públicos (regulamento e relatórios). Autorizações, contratos e comprovantes ficam restritos à administração.</StageNotice>}

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 mb-6">
        {(Object.keys(DOC_CATEGORY_LABEL) as DocCategory[]).filter((c) => canReadAll || PUBLIC_ALLOWED.includes(c)).map((c) => {
          const I = ICON[c]
          return (
            <Card key={c} as="article" className="p-4">
              <div className="flex items-start justify-between"><span className="grid place-items-center size-9 rounded-md bg-accent/10 text-accent"><I size={17} aria-hidden /></span>
                <Badge>{count(c)}</Badge></div>
              <p className="font-semibold text-sm mt-3">{DOC_CATEGORY_LABEL[c]}</p>
              <p className="text-xs text-muted mt-1 leading-relaxed">{HINT[c]}</p>
            </Card>
          )
        })}
      </div>

      <TableCard columns={columns} rows={docs.data} rowKey={(d) => d.id} loading={docs.loading} error={docs.error}
        searchPlaceholder="Buscar documento" filters={filters}
        matches={(d, q, f) => (!q || `${d.title} ${d.originalName ?? ''}`.toLowerCase().includes(q))
          && (f === 'Excluídos' ? !!d.deletedAt : !d.deletedAt && (f === 'Todos' || DOC_CATEGORY_LABEL[d.category] === f))}
        empty={{ icon: FileText, title: 'Nenhum documento', text: canReadAll ? 'Envie o regulamento, autorizações, contratos e comprovantes. Formatos: PDF e imagens, até 10 MB.' : 'Nenhum documento público ainda.' }} />
      <p className="text-xs text-faint mt-4">PDF, JPG, PNG ou WEBP, até 10 MB. Documentos de alunos e comprovantes nunca ficam públicos. Links para abrir valem 5 minutos.</p>

      <UploadModal open={uploading} onClose={() => setUploading(false)} onSaved={() => { docs.reload(); toast('Arquivo enviado') }} />
      <DeleteModal doc={deleting} onClose={() => setDeleting(null)} onDone={(m) => { docs.reload(); toast(m) }} />
    </>
  )
}

function UploadModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const students = useRemote(listStudents, open, [])
  const [file, setFile] = useState<File | null>(null)
  const [f, setF] = useState({ category: 'regulamento' as DocCategory, title: '', visibility: 'gestao' as 'gestao' | 'publico', studentId: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (open) { setFile(null); setF({ category: 'regulamento', title: '', visibility: 'gestao', studentId: '' }); setError(null) } }, [open])
  const canPublic = PUBLIC_ALLOWED.includes(f.category)
  const visibility = canPublic ? f.visibility : 'gestao'
  const sorted = useMemo(() => students.data.filter((s) => s.status === 'ativo'), [students.data])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!file) { setError('Escolha o arquivo.'); return }
    const problem = checkFile(file); if (problem) { setError(problem); return }
    if (f.title.trim().length < 2) { setError('Dê um título ao documento.'); return }
    setBusy(true); setError(null)
    try {
      await uploadDocument(file, { category: f.category, title: f.title, visibility, studentId: f.category === 'autorizacao' && f.studentId ? f.studentId : undefined })
      onClose(); onSaved()
    } catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Enviar arquivo" description="Fica guardado com seu nome e a data. Só regulamento e relatórios podem ser públicos."
      footer={<>
        {error && <p role="alert" className="mr-auto text-sm text-bad">{error}</p>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" type="submit" form="upload-form" loading={busy}>Enviar</Button>
      </>}>
      <form id="upload-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><FilePicker file={file} onPick={(x) => { setFile(x); setError(x ? checkFile(x) : null); if (x && !f.title) setF({ ...f, title: x.name.replace(/\.[^.]+$/, '').slice(0, 160) }) }} /></div>
        <Field label="Categoria">{(id) => <Select id={id} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as DocCategory })}>
          {Object.entries(DOC_CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>}</Field>
        <Field label="Acesso" hint={canPublic ? undefined : 'Esta categoria é sempre restrita'}>{(id) => <Select id={id} value={visibility} disabled={!canPublic} onChange={(e) => setF({ ...f, visibility: e.target.value as 'gestao' | 'publico' })}>
          <option value="gestao">Só administração e professor</option><option value="publico">Público (qualquer visitante)</option></Select>}</Field>
        <div className="sm:col-span-2"><Field label="Título">{(id) => <Input id={id} required maxLength={160} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />}</Field></div>
        {f.category === 'autorizacao' && <div className="sm:col-span-2"><Field label="Aluno" hint="Opcional. Liga a autorização ao cadastro do aluno.">{(id) => <Select id={id} value={f.studentId} onChange={(e) => setF({ ...f, studentId: e.target.value })}>
          <option value="">Nenhum</option>{sorted.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>}</Field></div>}
      </form>
    </Modal>
  )
}

function DeleteModal({ doc, onClose, onDone }: { doc: DocumentRow | null; onClose: () => void; onDone: (m: string) => void }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (doc) { setReason(''); setError(null) } }, [doc])
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (reason.trim().length < 3) { setError('Explique o motivo.'); return }
    setBusy(true); setError(null)
    try { await deleteDocument(doc!.id, reason); onClose(); onDone('Documento excluído') }
    catch (err) { onClose(); onDone((err as Error).message) }
    finally { setBusy(false) }
  }
  return (
    <Modal open={!!doc} onClose={onClose} title="Excluir documento"
      description={<>O arquivo <b className="text-ink">{doc?.title}</b> será removido. O registro (título, quem enviou, quando, quem excluiu e o motivo) continua no histórico.</>}
      footer={<>
        {error && <p role="alert" className="mr-auto text-sm text-bad">{error}</p>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" type="submit" form="delete-doc" loading={busy}>Excluir</Button>
      </>}>
      <form id="delete-doc" onSubmit={submit}>
        <Field label="Motivo">{(id) => <Input id={id} required maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: enviado por engano, versão substituída" />}</Field>
      </form>
    </Modal>
  )
}
