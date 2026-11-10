import { Building2, Check } from 'lucide-react'
import { ListPage } from '@/components/patterns/ListPage'
import { Badge, Card, CardHeader } from '@/components/ui'
import { money } from '@/lib/format'
import type { Proposal } from '@/types/domain'
import { STAGE2 } from '../stage'

const rows: Proposal[] = []
const CRITERIA = ['Preço por aluno', 'Transporte incluso', 'Hospedagem e categoria', 'Ingressos do parque', 'Refeições incluídas', 'Monitores e seguro-viagem', 'Forma de pagamento', 'Política de cancelamento', 'CNPJ e Cadastur ativos']

export function AgenciesPage() {
  return (
    <ListPage<Proposal>
      icon={Building2} section="Organização" title="Agências"
      description="Propostas recebidas lado a lado, com o que cada uma inclui e em que condições."
      createLabel="Adicionar proposta" notice={STAGE2}
      form={[
        { label: 'Agência', placeholder: 'Nome fantasia', wide: true },
        { label: 'CNPJ', placeholder: '00.000.000/0000-00' },
        { label: 'Contato', placeholder: 'Nome, telefone ou e-mail' },
        { label: 'Preço por aluno', type: 'money', placeholder: '0,00' },
        { label: 'Validade da proposta', type: 'date' },
        { label: 'O que inclui', type: 'textarea', placeholder: 'Transporte, hospedagem, ingressos, refeições…' },
      ]}
      searchPlaceholder="Buscar agência" rows={rows} rowKey={(r) => r.id}
      matches={(r, q) => !q || r.agency.toLowerCase().includes(q)}
      columns={[
        { key: 'agency', header: 'Agência', primary: true, render: (r) => <span className="font-medium">{r.agency}</span> },
        { key: 'contact', header: 'Contato', hideOnMobile: true, render: (r) => r.contact },
        { key: 'price', header: 'Por aluno', align: 'right', render: (r) => money(r.pricePerStudent) },
        { key: 'inc', header: 'Inclui', hideOnMobile: true, render: (r) => <span className="flex gap-1 flex-wrap">{r.includes.map((i) => <Badge key={i}>{i}</Badge>)}</span> },
        { key: 'valid', header: 'Validade', render: (r) => r.validUntil },
      ]}
      empty={{ icon: Building2, title: 'Nenhuma proposta recebida', text: 'Peça propostas com o mesmo escopo a pelo menos três agências para comparar de forma justa.' }}
      aside={
        <Card>
          <CardHeader title="Critérios de comparação" hint="Toda proposta será avaliada por estes itens" />
          <ul className="px-5 pb-5 text-sm space-y-2.5">
            {CRITERIA.map((c) => <li key={c} className="flex gap-2.5"><Check size={16} className="text-accent shrink-0 mt-0.5" aria-hidden />{c}</li>)}
          </ul>
        </Card>
      }
    />
  )
}
