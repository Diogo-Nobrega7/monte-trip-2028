import { Search, X } from 'lucide-react'
import { Segmented } from './Segmented'

export function Toolbar({ query, onQuery, placeholder, filters, active, onFilter, count }: {
  query: string; onQuery: (q: string) => void; placeholder: string
  filters?: string[]; active?: string; onFilter?: (f: string) => void; count: number
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-5 py-4">
      <div className="flex items-center gap-3">
        <label className="relative flex-1 lg:w-72 lg:flex-none">
          <span className="sr-only">{placeholder}</span>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
          <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder}
            className="w-full h-9 pl-9 pr-8 rounded-md bg-sunken text-sm placeholder:text-faint outline-none ring-1 ring-transparent focus:bg-surface focus:ring-accent transition" />
          {query && (
            <button onClick={() => onQuery('')} aria-label="Limpar busca" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-faint hover:text-ink">
              <X size={14} />
            </button>
          )}
        </label>
        <span className="num text-[13px] text-faint whitespace-nowrap">{count} {count === 1 ? 'registro' : 'registros'}</span>
      </div>
      {filters && active !== undefined && onFilter && <Segmented options={filters} value={active} onChange={onFilter} label="Filtrar" />}
    </div>
  )
}
