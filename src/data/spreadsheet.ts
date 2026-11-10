import { parseCsv } from '@/lib/csv'

/** Lê a primeira aba de um .xlsx ou um .csv como tabela de textos (datas viram AAAA-MM-DD). */
export async function readTable(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv') || file.type === 'text/csv') return parseCsv(await file.text())
  if (name.endsWith('.xlsx')) {
    const { readSheet } = await import('read-excel-file/browser')
    const rows = await readSheet(file)
    return rows.map((r) => r.map((c) => {
      if (c === null || c === undefined) return ''
      if (c instanceof Date) return c.toISOString().slice(0, 10)
      return String(c)
    }))
  }
  throw new Error('Formato não aceito. Use planilha do Excel (.xlsx) ou CSV.')
}
