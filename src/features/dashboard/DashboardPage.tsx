import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowLeftRight, ArrowUpRight, Banknote, Check, CircleDollarSign, FileWarning, LineChart, Receipt, ShieldAlert, Sprout, Target, TrendingUp } from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import type { RouteId } from '@/app/routes'
import { scenario } from '@/lib/finance'
import { money, moneyShort, percent } from '@/lib/format'
import { Badge, Card, CardHeader, EmptyState, Segmented, Stat } from '@/components/ui'
import { ChartLegend, ChartTooltip, ProjectionChart, axisTick, c, compactBRL } from '@/components/charts'
import { useAuth } from '@/data/auth'
import { connected } from '@/data/supabase'
import { getPublicMonthly, getPublicSummary, listPayments, type PublicSummary } from '@/data/repo'
import { listInstallments } from '@/data/installments'
import { listExpenses } from '@/data/cash'
import { listDocuments } from '@/data/documents'
import { listAgencies } from '@/data/agencies'
import { useSettingsState } from '@/app/SettingsContext'
import { dateBR, today, useRemote } from '@/data/useRemote'
import { delinquency, situations } from '@/lib/installments'
import { monthLabel } from '@/lib/settings'
import { JourneyTicket } from './JourneyTicket'
import { ParticipationRing } from './ParticipationRing'

// Tudo que é "realizado" vem do banco. Sem lançamento = zero. Nunca inventar números.
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
  const { source } = useSettingsState()
  const [view, setView] = useState('Projeção')
  const sc = scenario({ monthly: s.monthlyFee, months: s.months, annualRate: s.annualRate, students: s.expectedStudents, budgetPerStudent: s.budgetPerStudent })
  const auth = useAuth()
  const gestao = connected && auth.canReadAll
  // resumo público: só totais, aberto a qualquer visitante (funções resumo_publico* no banco)
  const summary = useRemote<PublicSummary | null>(getPublicSummary, connected, null)
  const monthly = useRemote(getPublicMonthly, connected, [])
  const docs = useRemote(listDocuments, connected, [])
  // detalhes só para admin e professor (RLS)
  const installments = useRemote(listInstallments, gestao, [])
  const payments = useRemote(listPayments, gestao, [])
  const expenses = useRemote(listExpenses, gestao, [])
  const agencies = useRemote(listAgencies, gestao, { agencies: [], proposals: [] })
  const now = today()

  const sum = summary.data
  const ACTUAL = {
    raised: (sum?.raised ?? 0) + (sum?.fundraisingNet ?? 0), yield: sum?.yields ?? 0, expenses: sum?.expenses ?? 0,
    balance: sum?.balance ?? 0, enrolled: sum?.activeStudents ?? 0,
  }
  const sits = useMemo(() => situations(installments.data, payments.data, now), [installments.data, payments.data, now])
  const late = delinquency(sits)
  const ontimeStudents = new Set(sits.map((i) => i.studentId)).size - late.lateStudents
  const regulationPublished = docs.data.some((d) => d.category === 'regulamento' && d.visibility === 'publico' && !d.deletedAt)
  const noReceipt = useMemo(() => {
    const withDoc = new Set(docs.data.filter((d) => d.expenseId && !d.deletedAt).map((d) => d.expenseId))
    const reversed = new Set(expenses.data.flatMap((e) => (e.reversalOf ? [e.reversalOf] : [])))
    return expenses.data.filter((e) => !e.reversalOf && !reversed.has(e.id) && !withDoc.has(e.id)).length
  }, [expenses.data, docs.data])

  const pendings = [
    { icon: FileWarning, label: regulationPublished ? 'Regulamento publicado' : 'Regulamento ainda não publicado', to: 'documentos' as RouteId, active: connected && !docs.loading && !regulationPublished },
    { icon: ShieldAlert, label: s.provisional ? 'Regras ainda provisórias' : 'Regras aprovadas pelo professor', to: 'configuracoes' as RouteId, active: s.provisional },
    ...(gestao ? [
      { icon: CircleDollarSign, label: `${late.lateCount} ${late.lateCount === 1 ? 'mensalidade' : 'mensalidades'} em atraso`, to: 'mensalidades' as RouteId, active: late.lateCount > 0 },
      { icon: Receipt, label: `${noReceipt} ${noReceipt === 1 ? 'despesa' : 'despesas'} sem comprovante`, to: 'despesas' as RouteId, active: noReceipt > 0 },
    ] : []),
  ]
  // etapas concluídas: só o que dá para conferir com dados reais
  const done: Partial<Record<RouteId, boolean>> = {
    configuracoes: source === 'banco' && !s.provisional,
    documentos: regulationPublished,
    alunos: ACTUAL.enrolled > 0,
    ...(gestao ? { mensalidades: installments.data.length > 0, agencias: agencies.data.proposals.length > 0 } : {}),
  }
  const doneCount = NEXT_STEPS.filter((st) => done[st.to]).length
  const balance = ACTUAL.balance

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
        <Stat icon={TrendingUp} label="Total arrecadado" value={money(ACTUAL.raised)} note="Mensalidades e ações (líquido)" />
        <Stat icon={Sprout} label="Rendimentos" value={money(ACTUAL.yield)} note="Conforme extrato" />
        <Stat icon={Receipt} label="Despesas" value={money(ACTUAL.expenses)} note="Saídas registradas" />
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
            ) : monthly.data.length ? (
              <RealizedChart data={monthly.data} budget={sc.groupBudget} />
            ) : (
              <EmptyState icon={LineChart} title={monthly.error ? 'Não foi possível carregar' : 'Ainda não há histórico'}>
                {monthly.error ?? 'O gráfico real começa com o primeiro lançamento registrado e mostra o saldo efetivo mês a mês.'}
              </EmptyState>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Participação" hint="Adesão em relação às vagas estimadas" />
            <div className="px-5 pb-5"><ParticipationRing enrolled={ACTUAL.enrolled} expected={s.expectedStudents} ontime={gestao ? Math.max(0, ontimeStudents) : 0} late={gestao ? late.lateStudents : 0} /></div>
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
          <span className="num text-[13px] text-faint">{doneCount} de {NEXT_STEPS.length} concluídas</span>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {NEXT_STEPS.map((st, i) => (
            <li key={st.label}>
              <button onClick={() => onNavigate(st.to)}
                className="group h-full w-full text-left rounded-lg p-4 bg-surface/60 ring-1 ring-line/70 hover:bg-surface hover:ring-accent/40 hover:shadow-md transition-all duration-200">
                <span className={`num grid place-items-center size-7 rounded-full text-xs font-semibold ${done[st.to] ? 'bg-ok text-white' : i === NEXT_STEPS.findIndex((x) => !done[x.to]) ? 'bg-accent text-accent-ink' : 'bg-sunken text-muted'}`}>
                  {done[st.to] ? <Check size={14} aria-label="concluída" /> : i + 1}</span>
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
              <span className="num font-semibold text-ink">{summary.data.payments}</span> pagamentos de mensalidade, somando{' '}
              <span className="num font-semibold text-ink">{money(summary.data.raised)}</span>.
              {summary.data.expenses > 0 && <> Despesas: <span className="num font-semibold text-ink">{money(summary.data.expenses)}</span>.</>}
              {summary.data.updatedAt && <> Última atualização em {dateBR(summary.data.updatedAt)}.</>}
            </p>
            <button onClick={() => onNavigate('relatorios')} className="text-sm font-medium text-accent hover:underline">Ver prestação de contas</button>
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

/** Saldo real acumulado mês a mês (totais públicos), contra a meta. */
function RealizedChart({ data, budget }: { data: { month: string; inflow: number; outflow: number; yields: number }[]; budget: number }) {
  let bal = 0
  const rows = data.map((m) => ({ mes: m.month, saldo: (bal += m.inflow + m.yields - m.outflow) }))
  return (
    <>
      <ChartLegend items={[{ label: 'Saldo real acumulado', color: c('gold') }]} />
      <div className="h-[280px] mt-3 -ml-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
            <defs><linearGradient id="gReal" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c('gold')} stopOpacity={0.5} /><stop offset="100%" stopColor={c('gold')} stopOpacity={0.05} /></linearGradient></defs>
            <CartesianGrid vertical={false} stroke={c('line')} />
            <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={axisTick} tickMargin={10} tickFormatter={monthLabel} minTickGap={12} />
            <YAxis tickLine={false} axisLine={false} width={76} tick={axisTick} tickFormatter={compactBRL} />
            <Tooltip content={<ChartTooltip labels={{ saldo: 'Saldo acumulado' }} titleFor={(m) => monthLabel(String(m))} />} />
            <Area type="monotone" dataKey="saldo" stroke={c('gold')} strokeWidth={2} fill="url(#gReal)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-faint mt-4">Dados reais registrados. Meta da viagem: {moneyShort(budget)}.</p>
    </>
  )
}
