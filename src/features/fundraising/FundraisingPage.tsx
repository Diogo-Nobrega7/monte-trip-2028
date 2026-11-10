import { HandCoins, Minus, PartyPopper, TrendingUp } from 'lucide-react'
import { ListPage } from '@/components/patterns/ListPage'
import { Badge } from '@/components/ui'
import { money } from '@/lib/format'
import type { Fundraising, FundraisingKind } from '@/types/domain'
import { STAGE2 } from '../stage'

const KIND: Record<FundraisingKind, string> = { rifa: 'Rifa', venda: 'Venda', evento: 'Evento', doacao: 'Doação', patrocinio: 'Patrocínio' }
const rows: Fundraising[] = []

export function FundraisingPage() {
  return (
    <ListPage<Fundraising>
      icon={HandCoins} section="Financeiro" title="Arrecadações"
      description="Ações coletivas com receita bruta, custos e o lucro que de fato entrou no caixa."
      createLabel="Registrar ação"
      notice={<>{STAGE2} Antes de organizar rifas, confirme com a escola se a modalidade é permitida. Vendas e eventos são alternativas seguras.</>}
      form={[
        { label: 'Nome da ação', placeholder: 'Ex.: Bazar de junho', wide: true },
        { label: 'Tipo', type: 'select', options: Object.values(KIND) },
        { label: 'Data', type: 'date' },
        { label: 'Receita bruta', type: 'money', placeholder: '0,00' },
        { label: 'Custos', type: 'money', placeholder: '0,00', hint: 'Materiais, taxas, compras para revenda' },
        { label: 'Observações', type: 'textarea', placeholder: 'Quem organizou, onde, como foi' },
      ]}
      metrics={[
        { icon: TrendingUp, label: 'Receita bruta', value: money(0) },
        { icon: Minus, label: 'Custos', value: money(0) },
        { icon: HandCoins, label: 'Lucro líquido', value: money(0), tone: 'ok', info: 'Receita bruta − custos de todas as ações.' },
        { icon: PartyPopper, label: 'Ações realizadas', value: 0 },
      ]}
      searchPlaceholder="Buscar ação" filters={['Todas', ...Object.values(KIND)]}
      rows={rows} rowKey={(r) => r.id}
      matches={(r, q, f) => (!q || r.title.toLowerCase().includes(q)) && (f === 'Todas' || KIND[r.kind] === f)}
      columns={[
        { key: 'title', header: 'Ação', primary: true, render: (r) => <span className="font-medium">{r.title}</span> },
        { key: 'kind', header: 'Tipo', render: (r) => <Badge>{KIND[r.kind]}</Badge> },
        { key: 'date', header: 'Data', hideOnMobile: true, render: (r) => r.date },
        { key: 'gross', header: 'Bruto', align: 'right', hideOnMobile: true, render: (r) => money(r.gross) },
        { key: 'costs', header: 'Custos', align: 'right', hideOnMobile: true, render: (r) => money(r.costs) },
        { key: 'net', header: 'Líquido', align: 'right', render: (r) => <b>{money(r.gross - r.costs)}</b> },
      ]}
      empty={{ icon: HandCoins, title: 'Nenhuma ação registrada', text: 'Registre vendas, eventos, doações e patrocínios com os custos para ver o lucro real de cada uma.' }}
    />
  )
}
