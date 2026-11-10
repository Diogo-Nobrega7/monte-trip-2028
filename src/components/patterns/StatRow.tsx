import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Card, Stat, cx } from '@/components/ui'

export interface StatItem { label: string; value: ReactNode; icon?: LucideIcon; note?: ReactNode; info?: string; tone?: 'default' | 'ok' | 'warn' | 'bad' }

/** Linha de indicadores numa só superfície, com divisórias (2 colunas no celular, 4 no desktop). */
export function StatRow({ items, className }: { items: StatItem[]; className?: string }) {
  return (
    <Card className={cx('grid grid-cols-2 lg:grid-cols-4 [&>*]:p-5 [&>*]:border-line',
      '[&>*:nth-child(odd)]:border-r lg:[&>*]:border-r lg:[&>*:last-child]:border-r-0',
      '[&>*:nth-child(-n+2)]:border-b lg:[&>*]:border-b-0', className)}>
      {items.map((m) => <Stat key={m.label} {...m} />)}
    </Card>
  )
}
