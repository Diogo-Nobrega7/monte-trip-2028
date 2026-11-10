/**
 * CSV no padrão que o Excel em português abre direto: separador ";", vírgula decimal,
 * BOM UTF-8 para acentos. Valores em centavos viram "1234,56" (sem passar por float).
 */

export type Cell = string | number | boolean | null | undefined

/** Centavos → "1234,56" (com sinal). */
export function centsToDecimal(c: number): string {
  const neg = c < 0
  const a = Math.abs(c)
  return `${neg ? '-' : ''}${Math.floor(a / 100)},${String(a % 100).padStart(2, '0')}`
}

function cell(v: Cell): string {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'boolean' ? (v ? 'sim' : 'não') : String(v)
  // aspas quando há separador, aspas ou quebra de linha; neutraliza fórmulas (=, +, -, @) no Excel
  const safe = /^[=+\-@]/.test(s) && !/^-?\d+(,\d+)?$/.test(s) ? `'${s}` : s
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n'
}

/** Lê CSV com separador ";" ou "," (detectado na primeira linha), aspas e quebras dentro de aspas. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const firstLine = src.split(/\r?\n/, 1)[0] ?? ''
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"' && field === '') quoted = true
    else if (ch === sep) { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += ch
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}
