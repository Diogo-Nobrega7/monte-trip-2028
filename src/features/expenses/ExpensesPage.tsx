import { CalendarDays, FileWarning, ListOrdered, Receipt } from 'lucide-react'
import { ListPage } from '@/components/patterns/ListPage'
import { Badge } from '@/components/ui'
import { money } from '@/lib/format'
import type { Expense, ExpenseCategory } from '@/types/domain'
import { STAGE2 } from '../stage'

const CAT: Record<ExpenseCategory, string> = {
  agencia: 'Agência', transporte: 'Transporte', hospedagem: 'Hospedagem', ingressos: 'Ingressos',
  materiais: 'Materiais', taxas: 'Taxas bancárias', outros: 'Outros',
}
const rows: Expense[] = []

export function ExpensesPage() {
  return (
    <ListPage<Expense>
      icon={Receipt} section="Financeiro" title="Despesas"
      description="Toda saída de dinheiro, com categoria, justificativa e comprovante."
      createLabel="Registrar despesa" notice={STAGE2}
      form={[
        { label: 'Descrição', placeholder: 'Ex.: Sinal da agência', wide: true },
        { label: 'Categoria', type: 'select', options: Object.values(CAT) },
        { label: 'Data', type: 'date' },
        { label: 'Valor', type: 'money', placeholder: '0,00' },
        { label: 'Justificativa', type: 'textarea', placeholder: 'Por que este gasto foi necessário' },
      ]}
      metrics={[
        { icon: Receipt, label: 'Total gasto', value: money(0) },
        { icon: CalendarDays, label: 'Neste mês', value: money(0) },
        { icon: FileWarning, label: 'Sem comprovante', value: 0, tone: 'warn' },
        { icon: ListOrdered, label: 'Lançamentos', value: 0 },
      ]}
      searchPlaceholder="Buscar despesa" filters={['Todas', ...Object.values(CAT)]}
      rows={rows} rowKey={(r) => r.id}
      matches={(r, q, f) => (!q || r.description.toLowerCase().includes(q)) && (f === 'Todas' || CAT[r.category] === f)}
      columns={[
        { key: 'desc', header: 'Descrição', primary: true, render: (r) => <span className="font-medium">{r.description}</span> },
        { key: 'cat', header: 'Categoria', render: (r) => <Badge>{CAT[r.category]}</Badge> },
        { key: 'date', header: 'Data', hideOnMobile: true, render: (r) => r.date },
        { key: 'receipt', header: 'Comprovante', render: (r) => r.hasReceipt ? <Badge dot tone="ok">Anexado</Badge> : <Badge dot tone="warn">Pendente</Badge> },
        { key: 'amount', header: 'Valor', align: 'right', render: (r) => money(r.amount) },
      ]}
      empty={{ icon: Receipt, title: 'Nenhuma despesa registrada', text: 'Cada despesa precisa de justificativa e comprovante para entrar na prestação de contas.' }}
    />
  )
}
