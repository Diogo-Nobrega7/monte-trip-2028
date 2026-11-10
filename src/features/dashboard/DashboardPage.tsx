import { useState } from 'react'
import { ArrowLeftRight, ArrowUpRight, Banknote, CircleDollarSign, FileWarning, LineChart, Receipt, Sprout, Target, TrendingUp } from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import type { RouteId } from '@/app/routes'
import { scenario } from '@/lib/finance'
import { money, moneyShort, percent } from '@/lib/format'
import { Badge, Card, CardHeader, EmptyState, Segmented, Stat } from '@/components/ui'
import { ChartLegend, ProjectionChart, c } from '@/components/charts'
import { useAuth } from '@/data/auth'
import { connected } from '@/data/supabase'
import { getPublicSummary, type PublicSummary } from '@/data/repo'
import { dateBR, useRemote } from '@/data/useRemote'
import { JourneyTicket } from './JourneyTicket'
import { ParticipationRing } from './ParticipationRing'

// Nenhum lançamento real ainda: tudo que é "realizado" é zero. Nunca inventar números.
// Rendimentos, despesas e parcelas chegam nas próximas etapas: até lá ficam em zero.
const PENDING = { yield: 0, expenses: 0, ontime: 0, late: 0, overdueInstallments: 0, expensesNoReceipt: 0 }

const NEXT_STEPS: { label: string; detail: string; to: RouteId }[] = [
  { label: 'Revisar regras com o professor', detail: 'Mensalidade, atraso e desistência', to: 'configuracoes' },
  { label: 'Publicar o regulamento', detail: 'Base para a adesão dos alunos', to: 'documentos' },
  { label: 'Cadastrar os alunos', detail: 'Com o responsável de cada um', to: 'alunos' },
  { label: 'Gerar as mensalidades', detail: 'A partir das regras aprovadas', to: 'mensalidades' },
  { label: 'Pedir propostas às agências', detail: 'Mesmo escopo para comparar', to: 'agencias' },
]

function greeting(name: string) {
  const h = new Date().getHours()
  return `${h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'}, ${name}.`
}

export function DashboardPage({ onNavigate }: { onNavigate: (r: RouteId) => void }) {
  const s = useSettings()
  const [view, setView] = useState('Projeção')
  const sc = scenario({ monthly: s.monthlyFee, months: s.months, annualRate: s.annualRate, students: s.expectedStudents, budgetPerStudent: s.budgetPerStudent })
  const auth = useAuth()
  // resumo público: só totais, aberto a qualquer visitante (função resumo_publico no banco)
  const summary = useRemote<PublicSummary | null>(getPublicSummary, connected, null)
  const ACTUAL = { ...PENDING, raised: summary.data?.raised ?? 0, enrolled: summary.data?.activeStudents ?? 0 }
  const balance = ACTUAL.raised + ACTUAL.yield - ACTUAL.expenses

  const pendings = [
    { icon: FileWarning, label: 'Regulamento ainda não publicado', to: 'documentos' as RouteId, active: true },
    { icon: CircleDollarSign, label: `${ACTUAL.overdueInstallments} mensalidades em atraso`, to: 'mensalidades' as RouteId, active: ACTUAL.overdueInstallments > 0 },
    { icon: Receipt, label: `${ACTUAL.expensesNoReceipt} despesas sem comprovante`, to: 'despesas' as RouteId, active: ACTUAL.expensesNoReceipt > 0 },
  ]

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Painel</h1>
      <JourneyTicket greeting={greeting(auth.name ?? 'turma')} raised={balance} budget={sc.groupBudget} projected={sc.coverage} months={s.months}
        origin={s.origin} destination={s.destination} destinationCity={s.destinationCity}
        year={s.tripYear} days={s.days} nights={s.nights} enrolled={ACTUAL.enrolled} expected={s.expectedStudents} />

      {/* indicadores: uma superfície, cinco leituras */}
      <Card className="grid grid-cols-2 lg:grid-cols-5 divide-line [&>*]:p-5 [&>*:not(:last-child)]:border-line
        [&>*]:border-b lg:[&>*]:border-b-0 lg:[&>*:not(:last-child)]:border-r [&>*:nth-child(odd):not(:last-child)]:border-r [&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1 [&>*:last-child]:border-b-0">
        <Stat icon={Banknote} label="Saldo atual" value={money(balance)} info="Arrecadado + rendimentos − despesas, conforme lançamentos registrados." />
        <Stat icon={TrendingUp} label="Total arrecadado" value={money(ACTUAL.raised)} note="Mensalidades e ações" />
        <Stat icon={Sprout} label="Rendimentos" value={money(ACTUAL.yield)} note="Informados pela aplicação" />
        <Stat icon={Receipt} label="Despesas" value={money(ACTUAL.expenses)} note="Com comprovante" />
        <Stat icon={Target} label="Falta arrecadar" value={moneyShort(Math.max(0, sc.groupBudget - balance))}
          tone="warn" note={`${moneyShort(s.budgetPerStudent)} por aluno`} info="Orçamento preliminar (por aluno × vagas estimadas) − saldo atual." />
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader title="Evolução financeira"
            hint={view === 'Projeção' ? `${moneyShort(s.monthlyFee)} por aluno ao mês, ${s.months} meses, ${percent(s.annualRate)} ao ano (hipotético)` : 'Saldo real mês a mês, a partir dos lançamentos'}
            action={<Segmented label="Visualização" options={['Projeção', 'Realizado']} value={view} onChange={setView} />} />
          <div className="px-5 pb-5">
            {view === 'Projeção' ? (
              <>
                <ChartLegend items={[
                  { label: 'Depositado', color: c('accent') },
                  { label: 'Rendimento', color: c('gold') },
                  { label: 'Meta da viagem', color: c('ink', 0.45), dashed: true },
                ]} />
                <div className="mt-3"><ProjectionChart monthly={s.monthlyFee} months={s.months} annualRate={s.annualRate} students={s.expectedStudents} budget={sc.groupBudget} /></div>
                <dl className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-line">
                  <div><dt className="text-[12px] text-faint">Depositado</dt><dd className="num font-semibold mt-1">{moneyShort(sc.perStudentDeposited * s.expectedStudents)}</dd></div>
                  <div><dt className="text-[12px] text-faint">Saldo projetado</dt><dd className="num font-semibold mt-1">{moneyShort(sc.groupBalance)}</dd></div>
                  <div><dt className="text-[12px] text-faint">{sc.gap > 0 ? 'A cobrir com ações' : 'Sobra prevista'}</dt>
                    <dd className={`num font-semibold mt-1 ${sc.gap > 0 ? 'text-warn' : 'text-ok'}`}>{moneyShort(Math.abs(sc.gap))}</dd></div>
                </dl>
                <p className="text-xs text-faint mt-4">Ilustrativo. Rendimentos não são garantidos e o orçamento ainda não foi cotado.</p>
              </>
            ) : (
              <EmptyState icon={LineChart} title="Ainda não há histórico">
                O gráfico real começa com o primeiro pagamento registrado e compara o saldo efetivo com a projeção.
              </EmptyState>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Participação" hint="Adesão em relação às vagas estimadas" />
            <div className="px-5 pb-5"><ParticipationRing enrolled={ACTUAL.enrolled} expected={s.expectedStudents} ontime={ACTUAL.ontime} late={ACTUAL.late} /></div>
          </Card>
          <Card>
            <CardHeader title="Pendências" action={<Badge tone={pendings.some((p) => p.active) ? 'warn' : 'ok'}>{pendings.filter((p) => p.active).length}</Badge>} />
            <ul className="px-2 pb-3">
              {pendings.map((p) => (
                <li key={p.label}>
                  <button onClick={() => onNavigate(p.to)} className="group w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm hover:bg-sunken transition-colors">
                    <p.icon size={16} className={p.active ? 'text-warn' : 'text-faint'} aria-hidden />
                    <span className={`flex-1 ${p.active ? 'text-ink' : 'text-muted'}`}>{p.label}</span>
                    <ArrowUpRight size={15} className="text-faint opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {/* próximas etapas: seção aberta, sem moldura, por ser uma sequência */}
      <section aria-labelledby="next-steps" className="pt-4">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 id="next-steps" className="font-display text-xl font-bold tracking-[-0.015em]">Próximas etapas</h2>
            <p className="text-sm text-muted mt-1">O caminho até o primeiro pagamento.</p>
          </div>
          <span className="num text-[13px] text-faint">0 de {NEXT_STEPS.length} concluídas</span>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {NEXT_STEPS.map((st, i) => (
            <li key={st.label}>
              <button onClick={() => onNavigate(st.to)}
                className="group h-full w-full text-left rounded-lg p-4 bg-surface/60 ring-1 ring-line/70 hover:bg-surface hover:ring-accent/40 hover:shadow-md transition-all duration-200">
                <span className={`num grid place-items-center size-7 rounded-full text-xs font-semibold ${i === 0 ? 'bg-accent text-accent-ink' : 'bg-sunken text-muted'}`}>{i + 1}</span>
                <p className="text-sm font-medium mt-3">{st.label}</p>
                <p className="text-[12px] text-muted mt-1">{st.detail}</p>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <Card>
        <CardHeader title="Atividade recente" hint="Totais públicos. Os detalhes por aluno ficam com a administração." />
        {summary.data && summary.data.payments > 0 ? (
          <div className="px-5 pb-5 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted">
              <span className="num font-semibold text-ink">{summary.data.payments}</span> pagamentos registrados, somando{' '}
              <span className="num font-semibold text-ink">{money(summary.data.raised)}</span>.
              {summary.data.updatedAt && <> Última atualização em {dateBR(summary.data.updatedAt)}.</>}
            </p>
            {auth.canReadAll && <button onClick={() => onNavigate('mensalidades')} className="text-sm font-medium text-accent hover:underline">Ver pagamentos</button>}
          </div>
        ) : (
          <EmptyState icon={ArrowLeftRight} title={summary.error ? 'Não foi possível carregar' : 'Nenhuma movimentação ainda'}>
            {summary.error ?? (connected ? 'Os totais aparecem aqui assim que o primeiro pagamento for registrado.' : 'Modo demonstração: o banco ainda não foi conectado.')}
          </EmptyState>
        )}
      </Card>
    </div>
  )
}
