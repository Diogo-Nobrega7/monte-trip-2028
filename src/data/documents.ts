import { db, friendly, selectAll } from './db'

/** Documentos no Storage (bucket privado "documentos") + registro com autor, data e vínculo. */

export type DocCategory = 'regulamento' | 'autorizacao' | 'contrato' | 'comprovante' | 'relatorio' | 'proposta' | 'outro'
export const DOC_CATEGORY_LABEL: Record<DocCategory, string> = {
  regulamento: 'Regulamento', autorizacao: 'Autorizações', contrato: 'Contratos', comprovante: 'Recibos e comprovantes',
  relatorio: 'Relatórios', proposta: 'Propostas de agências', outro: 'Outros',
}
/** Só estas categorias podem ser públicas (o banco também confere). */
export const PUBLIC_ALLOWED: DocCategory[] = ['regulamento', 'relatorio']

export const MAX_BYTES = 10 * 1024 * 1024
const EXT: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
export const ACCEPT = Object.keys(EXT).join(',')

export interface DocLink { studentId?: string; expenseId?: string; fundraisingId?: string; proposalId?: string }
export interface DocumentRow {
  id: string; category: DocCategory; title: string; path: string; originalName: string | null; mime: string; size: number
  visibility: 'gestao' | 'publico'; studentId: string | null; expenseId: string | null; fundraisingId: string | null; proposalId: string | null
  uploadedBy: string; uploadedAt: string; deletedAt: string | null; deletedBy: string | null; deleteReason: string | null
}

/** Confere tipo e tamanho antes de enviar (o bucket e a tabela conferem de novo). */
export function checkFile(f: File): string | null {
  if (!EXT[f.type]) return 'Formato não aceito. Envie PDF, JPG, PNG ou WEBP.'
  if (f.size > MAX_BYTES) return 'Arquivo maior que 10 MB.'
  if (f.size === 0) return 'Arquivo vazio.'
  return null
}

type DocDb = {
  id: string; categoria: DocCategory; titulo: string; arquivo_path: string; nome_original: string | null; tipo_mime: string; tamanho: number
  visibilidade: 'gestao' | 'publico'; student_id: string | null; expense_id: string | null; fundraising_id: string | null; proposal_id: string | null
  enviado_por: string; enviado_em: string; excluido_em: string | null; excluido_por: string | null; motivo_exclusao: string | null
}
const cols = 'id,categoria,titulo,arquivo_path,nome_original,tipo_mime,tamanho,visibilidade,student_id,expense_id,fundraising_id,proposal_id,enviado_por,enviado_em,excluido_em,excluido_por,motivo_exclusao'

export async function listDocuments(): Promise<DocumentRow[]> {
  const rows = await selectAll<DocDb>((a, b) => db().from('documents').select(cols).order('enviado_em', { ascending: false }).range(a, b))
  return rows.map((r) => ({
    id: r.id, category: r.categoria, title: r.titulo, path: r.arquivo_path, originalName: r.nome_original, mime: r.tipo_mime, size: Number(r.tamanho),
    visibility: r.visibilidade, studentId: r.student_id, expenseId: r.expense_id, fundraisingId: r.fundraising_id, proposalId: r.proposal_id,
    uploadedBy: r.enviado_por, uploadedAt: r.enviado_em, deletedAt: r.excluido_em, deletedBy: r.excluido_por, deleteReason: r.motivo_exclusao,
  }))
}

/**
 * Envia o arquivo e cria o registro. Se o registro falhar, o arquivo enviado é removido
 * (o Storage só deixa apagar arquivo sem registro ou com registro excluído).
 */
export async function uploadDocument(file: File, meta: { category: DocCategory; title: string; visibility: 'gestao' | 'publico' } & DocLink) {
  const problem = checkFile(file)
  if (problem) throw new Error(problem)
  const path = `${meta.category}/${crypto.randomUUID()}.${EXT[file.type]}`
  const storage = db().storage.from('documentos')
  const up = await storage.upload(path, file, { contentType: file.type, upsert: false })
  if (up.error) throw friendly({ message: up.error.message })
  const { error } = await db().from('documents').insert({
    categoria: meta.category, titulo: meta.title.trim(), arquivo_path: path, nome_original: file.name.slice(0, 200),
    tipo_mime: file.type, tamanho: file.size, visibilidade: meta.visibility,
    student_id: meta.studentId ?? null, expense_id: meta.expenseId ?? null, fundraising_id: meta.fundraisingId ?? null, proposal_id: meta.proposalId ?? null,
  })
  if (error) {
    await storage.remove([path])
    throw friendly(error)
  }
}

/** Link temporário (5 minutos) para ver ou baixar. Só funciona para quem tem permissão no banco. */
export async function documentUrl(path: string, download?: string): Promise<string> {
  const { data, error } = await db().storage.from('documentos').createSignedUrl(path, 300, download ? { download } : undefined)
  if (error) throw friendly({ message: error.message })
  return data.signedUrl
}

/** Marca como excluído (com motivo) e remove o arquivo. O registro continua para auditoria. */
export async function deleteDocument(id: string, reason: string) {
  const { data, error } = await db().rpc('excluir_documento', { p_id: id, p_motivo: reason })
  if (error) throw friendly(error)
  const rm = await db().storage.from('documentos').remove([data as string])
  if (rm.error) throw new Error('Registro excluído, mas o arquivo não foi removido do armazenamento. Tente excluir de novo mais tarde ou avise o administrador.')
}

export const formatBytes = (n: number) => n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`

/** Abre o arquivo numa nova aba. A aba abre antes do link ficar pronto para não ser barrada pelo navegador. */
export async function openDocument(path: string) {
  const w = window.open('', '_blank')
  try {
    const url = await documentUrl(path)
    if (w) w.location.href = url
    else window.location.href = url
  } catch (e) { w?.close(); throw e }
}
