import { useMemo, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Card, DataTable, EmptyState, Toolbar, type Column } from '@/components/ui'

/**
 * Cartão com busca, filtros e tabela (cartões no celular), com estados de carregamento,
 * vazio e "nada encontrado". Usado pela ListPage e por telas com mais de uma tabela.
 */
export function TableCard<T>(p: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (r: T) => string
  searchPlaceholder: string
  filters?: string[]
  matches?: (r: T, query: string, filter: string) => boolean
  loading?: boolean
  error?: string | null
  empty: { icon: LucideIcon; title: string; text: ReactNode; action?: ReactNode }
  /** Controles extras na barra (ex.: período). */
  extra?: ReactNode
  footer?: ReactNode
  className?: string
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(p.filters?.[0] ?? '')
  const rows = useMemo(
    () => (p.matches ? p.rows.filter((r) => p.matches!(r, query.trim().toLowerCase(), filter)) : p.rows),
    [p.rows, p.matches, query, filter],
  )
  const filtering = query !== '' || (p.filters && filter !== p.filters[0])
  return (
    <Card className={`min-w-0 overflow-hidden ${p.className ?? ''}`}>
      <Toolbar query={query} onQuery={setQuery} placeholder={p.searchPlaceholder} count={rows.length}
        filters={p.filters} active={filter} onFilter={setFilter} />
      {p.extra && <div className="px-5 pb-4 -mt-1 flex flex-wrap items-center gap-3">{p.extra}</div>}
      <DataTable columns={p.columns} rows={p.loading || p.error ? [] : rows} rowKey={p.rowKey}
        empty={p.loading
          ? <p className="px-5 py-14 text-center text-sm text-muted">Carregando…</p>
          : p.error
          ? <p role="alert" className="px-5 py-14 text-center text-sm text-bad">{p.error}</p>
          : filtering && p.rows.length > 0
          ? <EmptyState icon={p.empty.icon} title="Nada encontrado">Ajuste a busca ou os filtros.</EmptyState>
          : <EmptyState icon={p.empty.icon} title={p.empty.title} action={p.empty.action}>{p.empty.text}</EmptyState>} />
      {p.footer}
    </Card>
  )
}
