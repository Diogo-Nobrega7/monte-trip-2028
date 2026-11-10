import type { ReactNode } from 'react'
import { Plus, type LucideIcon } from 'lucide-react'
import { Button, PageHeader, StageNotice, type Column } from '@/components/ui'
import { StatRow, type StatItem } from './StatRow'
import { TableCard } from './TableCard'

/**
 * Padrão das páginas de cadastro: cabeçalho, indicadores, busca/filtros e tabela.
 * O formulário de cada página é um modal próprio, aberto por `onCreate`.
 */
export interface ListPageProps<T> {
  icon: LucideIcon
  section: string
  title: string
  description: string
  createLabel: string
  /** Abre o formulário da página. Sem ele, não há botão de criar. */
  onCreate?: () => void
  /** Botões extras no cabeçalho, antes do principal. */
  actions?: ReactNode
  /** Conteúdo entre os indicadores e a tabela. */
  before?: ReactNode
  /** Controles extras na barra da tabela (ex.: período). */
  extra?: ReactNode
  error?: string | null
  /** false esconde o botão de criar (ex.: visitante sem permissão). */
  canCreate?: boolean
  loading?: boolean
  metrics?: StatItem[]
  searchPlaceholder: string
  filters?: string[]
  columns: Column<T>[]
  rows: T[]
  rowKey: (r: T) => string
  matches?: (r: T, query: string, filter: string) => boolean
  empty: { icon: LucideIcon; title: string; text: ReactNode }
  notice?: ReactNode
  aside?: ReactNode
  /** Sem permissão de leitura: mostra só cabeçalho e aviso (nada de zeros que pareçam dados reais). */
  locked?: boolean
}

export function ListPage<T>(p: ListPageProps<T>) {
  const canCreate = p.canCreate ?? true
  const add = canCreate && p.onCreate ? <Button variant="primary" icon={Plus} onClick={p.onCreate}>{p.createLabel}</Button> : undefined
  return (
    <>
      <PageHeader icon={p.icon} section={p.section} title={p.title} description={p.description} actions={p.actions || add ? <>{p.actions}{add}</> : undefined} />
      {p.notice && <StageNotice>{p.notice}</StageNotice>}
      {!p.locked && <>
      {p.metrics && <StatRow items={p.metrics} className="mb-6" />}
      {p.before}
      <div className={p.aside ? 'grid gap-6 xl:grid-cols-[1fr_320px] items-start' : ''}>
        <TableCard columns={p.columns} rows={p.rows} rowKey={p.rowKey} searchPlaceholder={p.searchPlaceholder}
          filters={p.filters} matches={p.matches} loading={p.loading} error={p.error} extra={p.extra}
          empty={{ ...p.empty, action: add && <Button size="sm" icon={Plus} onClick={p.onCreate}>{p.createLabel}</Button> }} />
        {p.aside}
      </div>
      </>}
    </>
  )
}
