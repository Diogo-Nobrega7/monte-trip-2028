import { Plane, Settings, ShieldCheck, Sprout, Wallet } from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import { money, percent } from '@/lib/format'
import { Badge, Card, CardHeader, PageHeader, StageNotice } from '@/components/ui'

export function SettingsPage() {
  const s = useSettings()
  const groups = [
    { icon: Plane, title: 'Viagem', hint: 'Destino e grupo', rows: [
      ['Destino', `${s.destination}, ${s.destinationCity}`], ['Saída', s.origin], ['Ano', String(s.tripYear)],
      ['Duração', `${s.days} dias e ${s.nights} noites`], ['Participantes estimados', String(s.expectedStudents)], ['Orçamento por aluno', money(s.budgetPerStudent)],
    ] },
    { icon: Wallet, title: 'Mensalidades', hint: 'Valores e prazos', rows: [
      ['Valor sugerido', money(s.monthlyFee)], ['Número de parcelas', String(s.months)], ['Dia de vencimento', String(s.dueDay)], ['Adicional por atraso', percent(s.latePenalty)],
    ] },
    { icon: ShieldCheck, title: 'Participação', hint: 'Adesão e desistência', rows: [
      ['Adesão', 'Voluntária'], ['Devolução na desistência', percent(s.refundOnWithdrawal)], ['Retenção na desistência', percent(1 - s.refundOnWithdrawal)], ['Novos participantes', 'Permitidos, regras a definir'],
    ] },
    { icon: Sprout, title: 'Rendimento e governança', hint: 'Premissas e responsáveis', rows: [
      ['Rendimento anual hipotético', percent(s.annualRate)], ['Capitalização', 'Mensal equivalente'], ['Administração', s.admin], ['Supervisão', s.supervisor],
    ] },
  ]
  return (
    <>
      <PageHeader icon={Settings} section="Administração" title="Configurações" description="Parâmetros que alimentam os cálculos, as parcelas e as regras do projeto."
        actions={<Badge tone="gold">Todos provisórios</Badge>} />
      <StageNotice>Edição com histórico de alterações chega na etapa 2. Mudanças em regras financeiras vão exigir aprovação do professor supervisor.</StageNotice>
      <div className="grid gap-6 md:grid-cols-2">
        {groups.map((g) => (
          <Card key={g.title}>
            <CardHeader title={<span className="flex items-center gap-2"><g.icon size={16} className="text-accent" aria-hidden />{g.title}</span>} hint={g.hint} />
            <dl className="px-5 pb-5 text-sm divide-y divide-line/70">
              {g.rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-3 first:pt-0 last:pb-0"><dt className="text-muted">{k}</dt><dd className="num font-medium text-right">{v}</dd></div>
              ))}
            </dl>
          </Card>
        ))}
      </div>
    </>
  )
}
