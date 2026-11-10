import type { ISODate } from '@/types/domain'

/**
 * Importação de alunos de planilha (CSV ou Excel já convertido em linhas de texto).
 * Detecta colunas pelo cabeçalho, valida cada linha e marca duplicados (no arquivo e no cadastro).
 * Nada é gravado aqui: a tela mostra a prévia e só grava o que a pessoa confirmar.
 */

export interface ImportRow {
  line: number
  name: string
  guardianName: string
  guardianContact: string
  joinedAt: ISODate
  errors: string[]
  duplicate: 'arquivo' | 'cadastro' | null
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

const HEADERS: Record<'name' | 'guardianName' | 'guardianContact' | 'joinedAt', RegExp> = {
  name: /^(nome( do)? aluno|aluno|nome|estudante|nome completo)$/,
  guardianName: /^(responsavel|nome do responsavel|responsavel legal|pai\/mae|mae|pai)$/,
  guardianContact: /^(contato|telefone|celular|whatsapp|e-?mail|contato do responsavel|telefone do responsavel)$/,
  joinedAt: /^(adesao|data de adesao|data|entrada)$/,
}

/** "10/03/2027", "2027-03-10" ou número de série do Excel → 'AAAA-MM-DD'; null se inválida. */
export function parseDate(input: string): ISODate | null {
  const s = input.trim()
  let y: number, m: number, d: number
  let match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  if (match) { d = +match[1]; m = +match[2]; y = +match[3] }
  else if ((match = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) { y = +match[1]; m = +match[2]; d = +match[3] }
  else if (/^\d{5}$/.test(s)) {
    // número de série do Excel (dias desde 1899-12-30)
    const dt = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86_400_000)
    y = dt.getUTCFullYear(); m = dt.getUTCMonth() + 1; d = dt.getUTCDate()
  } else return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function parseStudentRows(table: string[][], existingNames: string[], today: ISODate): { rows: ImportRow[]; missingName: boolean } {
  if (!table.length) return { rows: [], missingName: true }
  const header = table[0].map(norm)
  const col = Object.fromEntries(
    (Object.keys(HEADERS) as (keyof typeof HEADERS)[]).map((k) => [k, header.findIndex((h) => HEADERS[k].test(h))]),
  ) as Record<keyof typeof HEADERS, number>
  if (col.name < 0) return { rows: [], missingName: true }

  const existing = new Set(existingNames.map(norm))
  const seen = new Set<string>()
  const rows = table.slice(1).map((r, i): ImportRow => {
    const get = (k: keyof typeof HEADERS) => (col[k] >= 0 ? (r[col[k]] ?? '').trim() : '')
    const name = get('name').replace(/\s+/g, ' ')
    const guardianName = get('guardianName')
    const guardianContact = get('guardianContact')
    const rawDate = get('joinedAt')
    const errors: string[] = []
    if (name.length < 2) errors.push('Nome vazio ou muito curto')
    if (name.length > 120) errors.push('Nome com mais de 120 caracteres')
    if (guardianName.length > 120) errors.push('Responsável com mais de 120 caracteres')
    if (guardianContact.length > 120) errors.push('Contato com mais de 120 caracteres')
    const joinedAt = rawDate ? parseDate(rawDate) : today
    if (!joinedAt) errors.push(`Data de adesão inválida: "${rawDate}"`)
    else if (joinedAt > today) errors.push('Data de adesão no futuro')
    const key = norm(name)
    const duplicate = existing.has(key) ? 'cadastro' : seen.has(key) ? 'arquivo' : null
    seen.add(key)
    return { line: i + 2, name, guardianName, guardianContact, joinedAt: joinedAt ?? today, errors, duplicate }
  })
  return { rows, missingName: false }
}

/** Só entram linhas sem erro e sem duplicidade. */
export const importable = (rows: ImportRow[]) => rows.filter((r) => !r.errors.length && !r.duplicate)
