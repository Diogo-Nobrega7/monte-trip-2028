import { useMemo, useState, type ReactNode } from 'react'
import { Plus, type LucideIcon } from 'lucide-react'
import {
  Button, Card, DataTable, EmptyState, Field, Input, Modal, PageHeader, Select, StageNotice, Toolbar, type Column,
} from '@/components/ui'
import { StatRow, type StatItem } from './StatRow'

export interface FormField {
  label: string
  type?: 'text' | 'date' | 'money' | 'select' | 'textarea'
  placeholder?: string
  options?: string[]
  hint?: string
  wide?: boolean
}

/**
 * Padrão das páginas de cadastro: cabeçalho, indicadores, busca/filtros, tabela e
 * formulário em modal. Etapa 1: listas vazias e formulário em prévia (sem gravar).
 */
export interface ListPageProps<T> {
  icon: LucideIcon
  section: string
  title: string
  description: string
  createLabel: string
  /** Campos da prévia (módulos ainda sem banco). Ignorado quando `onCreate` é passado. */
  form?: FormField[]
  /** Formulário real: abre o modal da própria página em vez da prévia. */
  onCreate?: () => void
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
  empty: { icon: LucideIcon; title: string; text: string }
  notice?: ReactNode
  aside?: ReactNode
}

export function ListPage<T>(p: ListPageProps<T>) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(p.filters?.[0] ?? '')
  const [open, setOpen] = useState(false)
  const rows = useMemo(
    () => (p.matches ? p.rows.filter((r) => p.matches!(r, query.trim().toLowerCase(), filter)) : p.rows),
    [p.rows, p.matches, query, filter],
  )
  const filtering = query !== '' || (p.filters && filter !== p.filters[0])
  const canCreate = p.canCreate ?? true
  const create = p.onCreate ?? (() => setOpen(true))
  const add = canCreate ? <Button variant="primary" icon={Plus} onClick={create}>{p.createLabel}</Button> : undefined

  return (
    <>
      <PageHeader icon={p.icon} section={p.section} title={p.title} description={p.description} actions={add} />
      {p.notice && <StageNotice>{p.notice}</StageNotice>}
      {p.metrics && <StatRow items={p.metrics} className="mb-6" />}
      <div className={p.aside ? 'grid gap-6 xl:grid-cols-[1fr_320px] items-start' : ''}>
        <Card className="min-w-0 overflow-hidden">
          <Toolbar query={query} onQuery={setQuery} placeholder={p.searchPlaceholder} count={rows.length}
            filters={p.filters} active={filter} onFilter={setFilter} />
          <DataTable columns={p.columns} rows={rows} rowKey={p.rowKey}
            empty={p.loading
              ? <p className="px-5 py-14 text-center text-sm text-muted">Carregando…</p>
              : filtering && p.rows.length > 0
              ? <EmptyState icon={p.empty.icon} title="Nada encontrado">Ajuste a busca ou os filtros.</EmptyState>
              : <EmptyState icon={p.empty.icon} title={p.empty.title}
                  action={canCreate && <Button size="sm" icon={Plus} onClick={create}>{p.createLabel}</Button>}>{p.empty.text}</EmptyState>} />
        </Card>
        {p.aside}
      </div>

      {p.form && !p.onCreate && <Modal open={open} onClose={() => setOpen(false)} title={p.createLabel}
        description="Prévia do formulário. Os campos podem ser preenchidos, mas ainda não são gravados."
        footer={<>
          <p className="mr-auto text-xs text-faint">Gravação disponível na etapa 2</p>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="primary" disabled title="Disponível quando o banco estiver conectado">Salvar</Button>
        </>}>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
          {p.form.map((f) => (
            <div key={f.label} className={f.wide || f.type === 'textarea' ? 'sm:col-span-2' : ''}>
              <Field label={f.label} hint={f.hint}>
                {(id) => f.type === 'select' ? (
                  <Select id={id} defaultValue="">{[<option key="" value="" disabled>Selecione</option>, ...(f.options ?? []).map((o) => <option key={o}>{o}</option>)]}</Select>
                ) : f.type === 'textarea' ? (
                  <textarea id={id} rows={3} placeholder={f.placeholder}
                    className="w-full rounded-md bg-surface ring-1 ring-line px-3 py-2 text-sm placeholder:text-faint outline-none hover:ring-faint/50 focus:ring-2 focus:ring-accent" />
                ) : (
                  <Input id={id} type={f.type === 'date' ? 'date' : f.type === 'money' ? 'number' : 'text'}
                    prefix={f.type === 'money' ? 'R$' : undefined} step={f.type === 'money' ? '0.01' : undefined}
                    min={f.type === 'money' ? 0 : undefined} placeholder={f.placeholder} />
                )}
              </Field>
            </div>
          ))}
        </form>
      </Modal>}
    </>
  )
}
