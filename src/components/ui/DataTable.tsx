import type { ReactNode } from 'react'
import { cx } from './cx'

export interface Column<T> {
  key: string
  header: string
  align?: 'left' | 'right'
  render: (row: T) => ReactNode
  /** Coluna principal: vira o título do cartão no celular. */
  primary?: boolean
  hideOnMobile?: boolean
}

/** Tabela no desktop; lista de cartões no celular (sem rolagem lateral). */
export function DataTable<T>({ columns, rows, rowKey, empty }: {
  columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; empty: ReactNode
}) {
  const primary = columns.find((c) => c.primary) ?? columns[0]
  const rest = columns.filter((c) => c !== primary && !c.hideOnMobile)
  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-line">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cx('px-5 h-10 font-medium text-faint text-xs whitespace-nowrap',
                  c.align === 'right' ? 'text-right' : 'text-left')}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} className="border-b border-line/70 last:border-0 transition-colors hover:bg-raised">
                {columns.map((c) => (
                  <td key={c.key} className={cx('px-5 h-14 num', c.align === 'right' && 'text-right')}>{c.render(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="md:hidden border-t border-line divide-y divide-line/70">
        {rows.map((r) => (
          <li key={rowKey(r)} className="px-5 py-4">
            <div className="font-medium">{primary.render(r)}</div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2.5 text-sm">
              {rest.map((c) => (
                <div key={c.key}><dt className="text-xs text-faint">{c.header}</dt><dd className="num mt-0.5">{c.render(r)}</dd></div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      {rows.length === 0 && <div className="border-t border-line md:border-t-0">{empty}</div>}
    </>
  )
}
