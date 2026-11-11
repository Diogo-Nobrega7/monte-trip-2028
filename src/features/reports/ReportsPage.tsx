import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowDownRight, ArrowUpRight, Banknote, FileBarChart, FileDown, Landmark, Plus, Printer, Sprout, Undo2, Wallet } from 'lucide-react'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageHeader, StageNotice, Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, Select, useToast, type Column } from '@/components/ui'
import { StatRow } from '@/components/patterns/StatRow'
import { TableCard } from '@/components/patterns/TableCard'
import { ReverseModal } from '@/components/patterns/ReverseModal'
import { ChartLegend, ChartTooltip, axisTick, c, compactBRL } from '@/components/charts'
import { useSettings } from '@/app/SettingsContext'
import { useAuth } from '@/data/auth'
import { connected } from '@/data/supabase'
import { CATEGORY_LABEL, KIND_LABEL, createYield, fundraisingTotals, listExpenses, listFundraisings, listLedger, listYields, reverseYield, type YieldRow } from '@/data/cash'
import { METHOD_LABEL, getPublicMonthly, getPublicSummary, listPayments, listStudents } from '@/data/repo'
import { listInstallments } from '@/data/installments'
import { downloadFile } from '@/data/backup'
import { dateBR, newKey, today, useRemote } from '@/data/useRemote'
import { centsToDecimal, toCsv } from '@/lib/csv'
import { money, moneyShort, percent } from '@/lib/format'
import { situations } from '@/lib/installments'
import { ORIGIN_LABEL, monthlySeries, summarize, withRunningBalance, type LedgerEntry } from '@/lib/ledger'
import { parseMoney } from '@/lib/payments'
import { PERIOD_LABEL, inRange, presetRange, rangeLabel, type PeriodPreset, type Range } from '@/lib/period'
import { monthLabel } from '@/lib/settings'
import { scenario } from '@/lib/finance'
import { printReport } from './printReport'
import { BalancesCard, MonthClosingCard } from './Closing'
import { checkedLedgerKeys, listBankBalances, listChecks, type BankBalance, type CheckRow } from '@/data/checks'
import { listDocuments } from '@/data/documents'

type Entry = LedgerEntry & { reference: string | null; createdAt: string }
const STATUS_LABEL = { paga: 'Paga', parcial: 'Parcial', pendente: 'A vencer', atrasada: 'Atrasada' }

/** Prestação de contas: só dados reais do banco. A projeção aparece separada e rotulada como ilustrativa. */
export function ReportsPage() {
  const s = useSettings()
  const { canReadAll, isAdmin, name } = useAuth()
  const toast = useToast()
  const enabled = connected && canReadAll
  const ledger = useRemote(listLedger, enabled, [])
  const students = useRemote(listStudents, enabled, [])
  const expenses = useRemote(listExpenses, enabled, [])
  const yields = useRemote(listYields, enabled, [])
  const installments = useRemote(listInstallments, enabled, [])
  const payments = useRemote(listPayments, enabled, [])
  const docs = useRemote(listDocuments, enabled, [])
  const checks = useRemote(listChecks, enabled, { available: false, rows: [] as CheckRow[] })
  const bank = useRemote(listBankBalances, enabled, { available: false, rows: [] as BankBalance[] })
  const publicSummary = useRemote(getPublicSummary, connected && !canReadAll, null)
  const publicMonthly = useRemote(getPublicMonthly, connected && !canReadAll, [])
  const [preset, setPreset] = useState<PeriodPreset | 'custom'>('tudo')
  const [custom, setCustom] = useState<Range>({ from: null, to: null })
  const [addingYield, setAddingYield] = useState(false)
  const [reversingYield, setReversingYield] = useState<YieldRow | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)
  const now = today()
  const range: Range = preset === 'custom' ? custom : presetRange(preset, now)

  const names = useMemo(() => new Map(students.data.map((st) => [st.id, st.name])), [students.data])
  const label = (e: Entry) => (e.origin === 'mensalidade' ? `${names.get(e.reference ?? '') ?? 'Aluno'}${e.description ? ` — ${e.description}` : ''}` : e.description ?? '')
  const withBal = useMemo(() => withRunningBalance(ledger.data).map((e) => ({ ...e, label: label(e) })), [ledger.data, names]) // eslint-disable-line react-hooks/exhaustive-deps
  const inPeriod = withBal.filter((e) => inRange(e.date, range))
  const sum = summarize(ledger.data, range)
  const byCategory = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of expenses.data) if (inRange(e.date, range)) m.set(CATEGORY_LABEL[e.category], (m.get(CATEGORY_LABEL[e.category]) ?? 0) + e.amount)
    return [...m.entries()].filter(([, v]) => v !== 0).sort((a, b) => b[1] - a[1])
  }, [expenses.data, range])
  const series = monthlySeries(ledger.data.filter((e) => inRange(e.date, range)))
  const sc = scenario({ monthly: s.monthlyFee, months: s.months, annualRate: s.annualRate, students: s.expectedStudents, budgetPerStudent: s.budgetPerStudent })
  const projectionText = `com ${s.expectedStudents} participantes pagando ${money(s.monthlyFee)} por ${s.months} meses a ${percent(s.annualRate)} ao ano, o saldo chegaria a ${moneyShort(sc.groupBalance)} contra uma meta de ${moneyShort(sc.groupBudget)}. Rendimento não garantido e orçamento ainda não cotado.`

  const closingInput = useMemo(() => ({
    ledger: ledger.data, installments: installments.data, payments: payments.data,
    activeStudentIds: new Set(students.data.filter((st) => st.status === 'ativo').map((st) => st.id)),
    expenses: expenses.data, expenseIdsWithReceipt: new Set(docs.data.filter((d) => d.expenseId && !d.deletedAt).map((d) => d.expenseId!)),
    checkedKeys: checkedLedgerKeys(checks.data.rows),
  }), [ledger.data, installments.data, payments.data, students.data, expenses.data, docs.data, checks.data.rows])

  async function exportCsv(kind: string) {
    setExporting(kind)
    try {
      const tag = preset === 'tudo' ? 'completo' : `${range.from ?? 'inicio'}_${range.to ?? now}`
      let header: string[] = [], rows: (string | number | null)[][] = []
      if (kind === 'livro') {
        header = ['Data', 'Tipo', 'Estorno', 'Descrição', 'Valor (R$)', 'Saldo (R$)']
        rows = inPeriod.map((e) => [dateBR(e.date), ORIGIN_LABEL[e.origin], e.reversal ? 'sim' : 'não', e.label, centsToDecimal(e.amount), centsToDecimal(e.balance)])
      } else if (kind === 'pagamentos') {
        const ps = await listPayments()
        header = ['Data', 'Aluno', 'Valor (R$)', 'Forma', 'Estorno de', 'Observação', 'Registrado em']
        rows = ps.filter((p) => inRange(p.paidAt, range)).reverse().map((p) => [dateBR(p.paidAt), names.get(p.studentId) ?? '', centsToDecimal(p.amount), METHOD_LABEL[p.method], p.reversalOf ? 'sim' : '', p.note, new Date(p.createdAt).toLocaleString('pt-BR')])
      } else if (kind === 'parcelas') {
        const [inst, ps] = await Promise.all([listInstallments(), listPayments()])
        header = ['Aluno', 'Parcela', 'Vencimento', 'Valor (R$)', 'Adicional (R$)', 'Pago (R$)', 'Falta (R$)', 'Situação']
        rows = situations(inst, ps, now).filter((i) => inRange(i.dueDate, range)).map((i) => [names.get(i.studentId) ?? '', i.number, dateBR(i.dueDate), centsToDecimal(i.amount), centsToDecimal(i.penalty), centsToDecimal(i.paid), centsToDecimal(i.remaining), STATUS_LABEL[i.status]])
      } else if (kind === 'arrecadacoes') {
        const fs = await listFundraisings()
        header = ['Data', 'Ação', 'Tipo', 'Responsável', 'Receita (R$)', 'Custos (R$)', 'Líquido (R$)']
        rows = fs.filter((f) => inRange(f.date, range)).map((f) => { const t = fundraisingTotals(f.entries); return [dateBR(f.date), f.title, KIND_LABEL[f.kind], f.responsible, centsToDecimal(t.gross), centsToDecimal(t.costs), centsToDecimal(t.net)] })
      } else if (kind === 'despesas') {
        header = ['Data', 'Descrição', 'Categoria', 'Valor (R$)', 'Estorno', 'Justificativa']
        rows = expenses.data.filter((e) => inRange(e.date, range)).map((e) => [dateBR(e.date), e.description, CATEGORY_LABEL[e.category], centsToDecimal(e.amount), e.reversalOf ? 'sim' : '', e.justification])
      }
      downloadFile(`monte-trip-${kind}-${tag}.csv`, toCsv(header, rows), 'text/csv;charset=utf-8')
      toast('Arquivo CSV baixado')
    } catch (e) { toast((e as Error).message, 'error') }
    finally { setExporting(null) }
  }

  function pdf() {
    try {
      printReport({ title: 'Prestação de contas — Monte Trip 2028', range, summary: sum, byCategory, entries: inPeriod, projection: { text: projectionText }, generatedBy: name })
    } catch (e) { toast((e as Error).message, 'error') }
  }

  if (!enabled) return <PublicReport summary={publicSummary} monthly={publicMonthly} />

  const loading = ledger.loading || students.loading || expenses.loading
  const error = ledger.error ?? students.error ?? expenses.error
  const columns: Column<typeof inPeriod[number]>[] = [
    { key: 'date', header: 'Data', primary: true, render: (e) => <span className="font-medium">{dateBR(e.date)}</span> },
    { key: 'type', header: 'Tipo', render: (e) => <span className="inline-flex gap-1"><Badge>{ORIGIN_LABEL[e.origin]}</Badge>{e.reversal && <Badge tone="bad">Estorno</Badge>}</span> },
    { key: 'desc', header: 'Descrição', hideOnMobile: true, render: (e) => <span className="text-muted">{e.label}</span> },
    { key: 'amount', header: 'Valor', align: 'right', render: (e) => <span className={e.amount < 0 ? 'text-bad' : 'text-ok'}>{e.amount > 0 ? '+' : ''}{money(e.amount)}</span> },
    { key: 'bal', header: 'Saldo', align: 'right', render: (e) => money(e.balance) },
  ]

  return (
    <>
      <PageHeader icon={FileBarChart} section="Financeiro" title="Prestação de contas"
        description="Entradas, saídas e saldo de qualquer período, com o histórico completo de movimentações. Só dados registrados."
        actions={<>
          {isAdmin && <Button icon={Plus} onClick={() => setAddingYield(true)}>Registrar rendimento</Button>}
          <Button variant="primary" icon={Printer} onClick={pdf} disabled={loading}>Gerar PDF</Button>
        </>} />

      <div className="mb-6"><BalancesCard ledger={ledger.data} bank={bank.data.rows[0] ?? null} bankAvailable={bank.data.available}
        yields={yields.data.reduce((a, y) => a + y.amount, 0)} projection={{ balance: sc.groupBalance, goal: sc.groupBudget }}
        canInform={isAdmin} onInformed={() => { bank.reload(); toast('Saldo do extrato registrado') }} /></div>

      <Card className="mb-6 p-4 flex flex-wrap items-end gap-3">
        <Field label="Período">{(id) => <Select id={id} value={preset} onChange={(e) => setPreset(e.target.value as PeriodPreset | 'custom')}>
          {(Object.keys(PERIOD_LABEL) as PeriodPreset[]).map((p) => <option key={p} value={p}>{PERIOD_LABEL[p]}</option>)}
          <option value="custom">Escolher datas</option></Select>}</Field>
        {preset === 'custom' && <>
          <Field label="De">{(id) => <Input id={id} type="date" value={custom.from ?? ''} onChange={(e) => setCustom({ ...custom, from: e.target.value || null })} />}</Field>
          <Field label="Até">{(id) => <Input id={id} type="date" value={custom.to ?? ''} onChange={(e) => setCustom({ ...custom, to: e.target.value || null })} />}</Field>
        </>}
        <p className="text-[13px] text-muted pb-2.5">{rangeLabel(range)}</p>
      </Card>

      <StatRow className="mb-6" items={[
        { icon: Landmark, label: 'Saldo inicial', value: money(sum.opening), info: 'Tudo que entrou menos tudo que saiu antes do início do período.' },
        { icon: ArrowUpRight, label: 'Entradas', value: money(sum.inflow), tone: 'ok', note: 'Mensalidades, ações e rendimentos' },
        { icon: ArrowDownRight, label: 'Saídas', value: money(sum.outflow), tone: sum.outflow ? 'warn' : 'default', note: 'Despesas' },
        { icon: Wallet, label: 'Saldo final', value: money(sum.closing), note: 'Confira com o extrato bancário' },
      ]} />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px] mb-6">
        <Card>
          <CardHeader title="Arrecadado × gasto" hint="Por mês, no período escolhido" />
          <div className="px-5 pb-5">
            {series.length ? <>
              <ChartLegend items={[{ label: 'Entradas', color: c('ok') }, { label: 'Saídas', color: c('bad') }, { label: 'Saldo acumulado no período', color: c('accent') }]} />
              <div className="h-[260px] mt-3 -ml-1"><ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={c('line')} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={axisTick} tickFormatter={monthLabel} minTickGap={12} />
                  <YAxis tickLine={false} axisLine={false} width={76} tick={axisTick} tickFormatter={compactBRL} />
                  <Tooltip cursor={{ fill: c('sunken', 0.6) }} content={<ChartTooltip labels={{ inflow: 'Entradas', outflow: 'Saídas', balance: 'Saldo acumulado' }} titleFor={(m) => monthLabel(String(m))} />} />
                  <Bar dataKey="inflow" fill={c('ok', 0.75)} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="outflow" fill={c('bad', 0.7)} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Line dataKey="balance" stroke={c('accent')} strokeWidth={2} dot={false} type="monotone" />
                </ComposedChart>
              </ResponsiveContainer></div>
            </> : <EmptyState icon={Banknote} title="Sem movimentações no período">O gráfico aparece com o primeiro lançamento.</EmptyState>}
          </div>
        </Card>
        <Card>
          <CardHeader title="Composição" hint={rangeLabel(range)} />
          <dl className="px-5 pb-5 text-sm divide-y divide-line/70 num">
            {[['Mensalidades', sum.tuition], ['Arrecadações (líquido)', sum.fundraisingNet], ['Rendimentos', sum.yields], ['Despesas', -sum.expenses]].map(([k, v]) => (
              <div key={k as string} className="flex justify-between gap-4 py-2.5"><dt className="text-muted">{k}</dt><dd className={`font-medium ${(v as number) < 0 ? 'text-bad' : ''}`}>{money(v as number)}</dd></div>
            ))}
            <div className="flex justify-between gap-4 py-2.5"><dt className="font-semibold">Resultado</dt><dd className="font-semibold">{money(sum.inflow - sum.outflow)}</dd></div>
            {byCategory.length > 0 && <div className="pt-3">
              <dt className="text-xs text-faint mb-1.5">Despesas por categoria</dt>
              {byCategory.map(([k, v]) => <dd key={k} className="flex justify-between py-1 text-[13px]"><span className="text-muted">{k}</span><span>{money(v)}</span></dd>)}
            </div>}
          </dl>
        </Card>
      </div>

      <div className="mb-6"><MonthClosingCard input={closingInput} checksAvailable={checks.data.available} ledger={ledger.data}
        generatedBy={name} onError={(m) => toast(m, 'error')} /></div>

      <Card className="mb-6 ring-gold/40">
        <CardHeader title={<span className="flex items-center gap-2">Projeção <Badge tone="gold">Ilustrativa</Badge></span>} hint="Não é dado real. Serve para comparar com o que de fato entrou." />
        <div className="px-5 pb-5 grid gap-4 sm:grid-cols-3 text-sm num">
          <div><p className="text-xs text-faint">Saldo projetado ao fim</p><p className="font-semibold mt-1">{moneyShort(sc.groupBalance)}</p></div>
          <div><p className="text-xs text-faint">Meta (orçamento estimado)</p><p className="font-semibold mt-1">{moneyShort(sc.groupBudget)}</p></div>
          <div><p className="text-xs text-faint">Saldo real hoje</p><p className="font-semibold mt-1">{money(summarize(ledger.data, { from: null, to: null }).closing)}</p></div>
          <p className="sm:col-span-3 text-[13px] text-muted font-sans">Premissas: {projectionText}</p>
        </div>
      </Card>

      <h2 className="font-display text-xl font-bold tracking-[-0.015em] mb-3">Histórico de movimentações</h2>
      <TableCard columns={columns} rows={[...inPeriod].reverse()} rowKey={(e) => `${e.origin}-${e.id}`} loading={loading} error={error}
        searchPlaceholder="Buscar descrição" filters={['Tudo', 'Mensalidades', 'Arrecadações', 'Despesas', 'Rendimentos', 'Estornos']}
        matches={(e, q, f) => (!q || e.label.toLowerCase().includes(q)) && (f === 'Tudo' || (f === 'Estornos' ? e.reversal
          : f === 'Mensalidades' ? e.origin === 'mensalidade' : f === 'Arrecadações' ? e.origin === 'arrecadacao' || e.origin === 'custo_arrecadacao'
          : f === 'Despesas' ? e.origin === 'despesa' : e.origin === 'rendimento'))}
        empty={{ icon: Banknote, title: 'Nenhuma movimentação', text: 'Pagamentos, ações, despesas e rendimentos registrados aparecem aqui, com o saldo após cada um.' }} />

      <div className="grid gap-6 lg:grid-cols-2 mt-6">
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><FileDown size={16} className="text-accent" aria-hidden />Exportar planilhas (CSV)</span>} hint={`Abre no Excel. Período: ${rangeLabel(range)}.`} />
          <div className="px-5 pb-5 flex flex-wrap gap-2">
            {[['livro', 'Livro-caixa'], ['pagamentos', 'Pagamentos'], ['parcelas', 'Parcelas'], ['arrecadacoes', 'Arrecadações'], ['despesas', 'Despesas']].map(([k, l]) => (
              <Button key={k} size="sm" icon={FileDown} loading={exporting === k} onClick={() => void exportCsv(k)}>{l}</Button>
            ))}
          </div>
          <p className="px-5 pb-5 -mt-2 text-xs text-faint">Pagamentos e parcelas têm nomes de alunos: não publique esses arquivos.</p>
        </Card>
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Sprout size={16} className="text-accent" aria-hidden />Rendimentos</span>} hint="Lançados a partir do extrato da aplicação. Nunca calculados pelo sistema." />
          {yields.data.length ? <ul className="px-5 pb-5 divide-y divide-line/70 text-sm">
            {yields.data.slice(0, 8).map((y) => {
              const reversed = yields.data.some((x) => x.reversalOf === y.id)
              return (
                <li key={y.id} className="flex flex-wrap items-center justify-between gap-2 py-2 num">
                  <span>{dateBR(y.date)}<span className="text-muted"> · {y.institution ?? 'Aplicação'}{y.description && ` · ${y.description}`}</span></span>
                  <span className="flex items-center gap-2"><span className={y.amount < 0 ? 'text-bad' : ''}>{money(y.amount)}</span>
                    {y.reversalOf ? <Badge tone="bad">Estorno</Badge> : reversed ? <Badge>Estornado</Badge> : isAdmin && <Button size="sm" variant="ghost" icon={Undo2} onClick={() => setReversingYield(y)}>Estornar</Button>}</span>
                </li>
              )
            })}
          </ul> : <p className="px-5 pb-5 text-sm text-muted">Nenhum rendimento registrado. Quando o dinheiro estiver aplicado, lance o rendimento de cada mês conforme o extrato.</p>}
        </Card>
      </div>

      <YieldForm open={addingYield} onClose={() => setAddingYield(false)} onSaved={() => { yields.reload(); ledger.reload(); toast('Rendimento registrado') }} />
      <ReverseModal open={!!reversingYield} title="Estornar rendimento" onClose={() => setReversingYield(null)}
        summary={reversingYield && <>{money(reversingYield.amount)} em {dateBR(reversingYield.date)}.</>}
        onConfirm={async (reason, key) => { await reverseYield(reversingYield!, reason, key, now); yields.reload(); ledger.reload(); toast('Estorno registrado') }} />
    </>
  )
}

function YieldForm({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ date: today(), amount: '', institution: '', description: '' })
  const [key, setKey] = useState(newKey)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (open) { setF({ date: today(), amount: '', institution: '', description: '' }); setKey(newKey()); setError(null) } }, [open])
  async function submit(e: FormEvent) {
    e.preventDefault()
    const cents = parseMoney(f.amount)
    if (cents === null) { setError('Valor inválido.'); return }
    if (f.date > today()) { setError('A data não pode ser no futuro.'); return }
    setBusy(true); setError(null)
    try { await createYield({ ...f, amount: cents, idempotencyKey: key }); onClose(); onSaved() }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Registrar rendimento" description="Copie do extrato o rendimento líquido do período. Taxas e impostos cobrados à parte entram em Despesas."
      footer={<>
        {error && <p role="alert" className="mr-auto text-sm text-bad">{error}</p>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" type="submit" form="yield-form" loading={busy}>Salvar</Button>
      </>}>
      <form id="yield-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Data do extrato">{(id) => <Input id={id} type="date" required max={today()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />}</Field>
        <Field label="Valor">{(id) => <Input id={id} prefix="R$" inputMode="decimal" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0,00" />}</Field>
        <Field label="Instituição" hint="Ex.: banco, corretora">{(id) => <Input id={id} maxLength={120} value={f.institution} onChange={(e) => setF({ ...f, institution: e.target.value })} />}</Field>
        <Field label="Descrição" hint="Ex.: rendimento de março">{(id) => <Input id={id} maxLength={300} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />}</Field>
      </form>
    </Modal>
  )
}

/** Visitante: só os totais públicos (sem nomes nem valores individuais). */
function PublicReport({ summary, monthly }: { summary: { data: Awaited<ReturnType<typeof getPublicSummary>> | null; loading: boolean; error: string | null }; monthly: { data: Awaited<ReturnType<typeof getPublicMonthly>> } }) {
  const d = summary.data
  return (
    <>
      <PageHeader icon={FileBarChart} section="Financeiro" title="Prestação de contas" description="Totais do caixa da turma, abertos a todos. O detalhamento fica com a administração e o professor." />
      {!connected && <StageNotice>Modo demonstração: o banco ainda não foi conectado.</StageNotice>}
      {summary.error && <StageNotice>{summary.error}</StageNotice>}
      <StatRow className="mb-6" items={[
        { icon: Wallet, label: 'Saldo atual', value: money(d?.balance ?? 0) },
        { icon: ArrowUpRight, label: 'Mensalidades', value: money(d?.raised ?? 0), tone: 'ok' },
        { icon: Plus, label: 'Arrecadações (líquido)', value: money(d?.fundraisingNet ?? 0) },
        { icon: ArrowDownRight, label: 'Despesas', value: money(d?.expenses ?? 0) },
      ]} />
      <Card>
        <CardHeader title="Por mês" hint="Entradas e saídas registradas" />
        {monthly.data.length ? <ul className="px-5 pb-5 divide-y divide-line/70 text-sm num">
          {monthly.data.map((m) => <li key={m.month} className="flex justify-between py-2"><span>{monthLabel(m.month)}</span><span><span className="text-ok">+{money(m.inflow + m.yields)}</span> · <span className="text-bad">−{money(m.outflow)}</span></span></li>)}
        </ul> : <EmptyState icon={Banknote} title="Nenhuma movimentação ainda">Os totais aparecem aqui assim que o primeiro lançamento for registrado.</EmptyState>}
      </Card>
    </>
  )
}
