import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, CalendarClock, CircleCheck, FileText, HandCoins, History, ListChecks, RefreshCw, Undo2, Users, Wallet } from 'lucide-react'
import { PageHeader, Segmented, StageNotice, Badge, Button, Field, Input, Modal, Select, useToast, type Column, type Tone } from '@/components/ui'
import { StatRow } from '@/components/patterns/StatRow'
import { TableCard } from '@/components/patterns/TableCard'
import { ReverseModal } from '@/components/patterns/ReverseModal'
import { CheckCell } from '@/components/patterns/CheckCell'
import { listChecks, type CheckRow } from '@/data/checks'
import { listProfileNames } from '@/data/settings'
import { printReceipt } from '../reports/print'
import { useSettingsState } from '@/app/SettingsContext'
import { useAuth } from '@/data/auth'
import { connected } from '@/data/supabase'
import {
  METHOD_LABEL, createDistributedPayment, createPayment, listPayments, listStudents, reversePayment,
  type PaymentMethod, type PaymentRow, type StudentRow,
} from '@/data/repo'
import { listInstallments, syncInstallments, type InstallmentRow } from '@/data/installments'
import { dateBR, newKey, today, useRemote } from '@/data/useRemote'
import { money, moneyShort, percent } from '@/lib/format'
import { parseMoney, reversedIds, totalRaised } from '@/lib/payments'
import { delinquency, distribute, maxPayment, refundOnWithdrawal, situations, type InstallmentStatus, type Situation } from '@/lib/installments'
import { lastMonth, monthLabel } from '@/lib/settings'
import { accessNotice } from '../stage'

export const STATUS: Record<InstallmentStatus, { label: string; tone: Tone }> = {
  paga: { label: 'Paga', tone: 'ok' }, parcial: { label: 'Parcial', tone: 'accent' },
  pendente: { label: 'A vencer', tone: 'neutral' }, atrasada: { label: 'Atrasada', tone: 'bad' },
}
type InstRow = InstallmentRow & Situation & { studentName: string; total: number; active: boolean }
type PayRow = PaymentRow & { studentName: string; reversed: boolean; installmentLabel: string }

/**
 * Mensalidades: parcelas geradas pelas regras aprovadas, pagamentos (inteiros, parciais ou
 * distribuídos) e estornos. Situação de cada parcela calculada por lib/installments (mesmas regras do banco).
 */
export function InstallmentsPage() {
  const { settings: s, source } = useSettingsState()
  const { canReadAll, isAdmin } = useAuth()
  const toast = useToast()
  const enabled = connected && canReadAll
  const students = useRemote(listStudents, enabled, [])
  const payments = useRemote(listPayments, enabled, [])
  const checks = useRemote(listChecks, enabled, { available: false, rows: [] as CheckRow[] })
  const names = useRemote(listProfileNames, enabled, new Map<string, string>())
  const installments = useRemote(listInstallments, enabled, [])
  const [tab, setTab] = useState('Parcelas')
  const [paying, setPaying] = useState<{ studentId?: string; installmentId?: string } | null>(null)
  const [reversing, setReversing] = useState<PayRow | null>(null)
  const [generating, setGenerating] = useState(false)
  const [historyOf, setHistoryOf] = useState<StudentRow | null>(null)
  const now = today()
  const reloadAll = () => { payments.reload(); installments.reload() }

  const studentById = useMemo(() => new Map(students.data.map((st) => [st.id, st])), [students.data])
  const instRows: InstRow[] = useMemo(() => {
    const totals = new Map<string, number>()
    for (const i of installments.data) totals.set(i.studentId, (totals.get(i.studentId) ?? 0) + 1)
    return situations(installments.data, payments.data, now).map((i) => ({
      ...i, studentName: studentById.get(i.studentId)?.name ?? '—', total: totals.get(i.studentId) ?? 0,
      active: studentById.get(i.studentId)?.status === 'ativo',
    }))
  }, [installments.data, payments.data, studentById, now])
  const instById = useMemo(() => new Map(instRows.map((i) => [i.id, i])), [instRows])

  const payRows: PayRow[] = useMemo(() => {
    const rev = reversedIds(payments.data)
    return payments.data.map((p) => {
      const i = p.installmentId ? instById.get(p.installmentId) : undefined
      return { ...p, studentName: studentById.get(p.studentId)?.name ?? '—', reversed: rev.has(p.id), installmentLabel: i ? `${i.number}/${i.total}` : 'Avulso' }
    })
  }, [payments.data, studentById, instById])

  const d = delinquency(instRows.filter((r) => r.active))
  const month = now.slice(0, 7)
  const loading = students.loading || payments.loading || installments.loading
  const error = students.error ?? payments.error ?? installments.error
  const notice = accessNotice(connected, canReadAll)
    ?? (enabled && !installments.data.length && !loading
      ? (s.provisional
        ? 'As regras ainda estão marcadas como provisórias. Quando forem definitivas, desmarque "Regras ainda provisórias" em Configurações e gere as parcelas. Até lá, registre pagamentos como avulsos.'
        : !s.startMonth ? 'Defina o mês da primeira parcela em Configurações para gerar as parcelas.' : 'Regras definitivas. Use "Gerar parcelas" para criar as mensalidades de cada aluno ativo.')
      : null)

  const instColumns: Column<InstRow>[] = [
    { key: 'student', header: 'Aluno', primary: true, render: (r) => <span className="font-medium">{r.studentName}{!r.active && <span className="text-faint font-normal"> (desistente)</span>}</span> },
    { key: 'n', header: 'Parcela', render: (r) => `${r.number}/${r.total}` },
    { key: 'due', header: 'Vencimento', render: (r) => dateBR(r.dueDate) },
    { key: 'amount', header: 'Valor', align: 'right', hideOnMobile: true, render: (r) => money(r.amount) },
    { key: 'penalty', header: 'Adicional', align: 'right', hideOnMobile: true, render: (r) => (r.penalty ? <span className="text-bad">{money(r.penalty)}</span> : <span className="text-faint">—</span>) },
    { key: 'paid', header: 'Pago', align: 'right', render: (r) => money(r.paid) },
    { key: 'remaining', header: 'Falta', align: 'right', render: (r) => (r.remaining ? <b className="font-semibold">{money(r.remaining)}</b> : <span className="text-faint">—</span>) },
    { key: 'status', header: 'Situação', render: (r) => (
      <span className="inline-flex items-center gap-2">
        <Badge dot tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
        {isAdmin && r.status !== 'paga' && r.active && <Button size="sm" variant="ghost" onClick={() => setPaying({ studentId: r.studentId, installmentId: r.id })}>Receber</Button>}
      </span>
    ) },
  ]

  const checksBy = useMemo(() => {
    const m = new Map<string, CheckRow[]>()
    for (const c of checks.data.rows) if (c.table === 'payments') m.set(c.recordId, [...(m.get(c.recordId) ?? []), c])
    return m
  }, [checks.data.rows])
  function receipt(r: PayRow) {
    const inst = r.installmentId ? instById.get(r.installmentId) : undefined
    try {
      printReceipt({
        id: r.id, studentName: r.studentName, guardianName: studentById.get(r.studentId)?.guardianName ?? null, amount: r.amount, paidAt: r.paidAt,
        method: METHOD_LABEL[r.method], note: r.note, createdAt: r.createdAt, admin: s.admin,
        reference: inst ? `parcela ${inst.number}/${inst.total} da contribuição para a viagem (vencimento ${dateBR(inst.dueDate)})` : 'contribuição para a viagem de formatura',
      })
    } catch (e) { toast((e as Error).message, 'error') }
  }
  const payColumns: Column<PayRow>[] = [
    { key: 'student', header: 'Aluno', primary: true, render: (r) => <span className="font-medium">{r.studentName}</span> },
    { key: 'date', header: 'Data', render: (r) => dateBR(r.paidAt) },
    { key: 'inst', header: 'Parcela', render: (r) => r.installmentLabel },
    { key: 'amount', header: 'Valor', align: 'right', render: (r) => <span className={r.amount < 0 ? 'text-bad' : ''}>{money(r.amount)}</span> },
    { key: 'method', header: 'Forma', hideOnMobile: true, render: (r) => METHOD_LABEL[r.method] },
    { key: 'note', header: 'Observação', hideOnMobile: true, render: (r) => <span className="text-muted">{r.note ?? ''}</span> },
    ...(checks.data.available ? [{ key: 'check', header: 'Conferência', render: (r: PayRow) => (
      <CheckCell table="payments" recordId={r.id} history={checksBy.get(r.id) ?? []} names={names.data} canCheck={canReadAll}
        summary={<>{r.studentName}, {money(r.amount)} em {dateBR(r.paidAt)}.</>} onSaved={() => { checks.reload(); toast('Conferência registrada') }} />
    ) }] : []),
    { key: 'status', header: 'Situação', render: (r) => (
      r.reversalOf ? <Badge tone="bad">Estorno</Badge>
      : r.reversed ? <Badge tone="neutral">Estornado</Badge>
      : <span className="inline-flex items-center gap-1"><Badge dot tone="ok">Recebido</Badge>
          <Button size="sm" variant="ghost" icon={FileText} onClick={() => receipt(r)}>Recibo</Button>
          {isAdmin && <Button size="sm" variant="ghost" icon={Undo2} onClick={() => setReversing(r)}>Estornar</Button>}</span>
    ) },
  ]

  type ByStudent = StudentRow & { paid: number; late: number; open: number; paidCount: number; count: number }
  const byStudent: ByStudent[] = useMemo(() => students.data.map((st) => {
    const mine = instRows.filter((i) => i.studentId === st.id)
    return {
      ...st, paid: payments.data.filter((p) => p.studentId === st.id).reduce((a, p) => a + p.amount, 0),
      late: mine.filter((i) => i.status === 'atrasada').length, open: mine.reduce((a, i) => a + i.remaining, 0),
      paidCount: mine.filter((i) => i.status === 'paga').length, count: mine.length,
    }
  }), [students.data, instRows, payments.data])
  const studentColumns: Column<ByStudent>[] = [
    { key: 'name', header: 'Aluno', primary: true, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'parc', header: 'Parcelas pagas', render: (r) => (r.count ? `${r.paidCount} de ${r.count}` : '—') },
    { key: 'late', header: 'Em atraso', render: (r) => (r.late ? <Badge dot tone="bad">{r.late}</Badge> : <span className="text-faint">—</span>) },
    { key: 'paid', header: 'Total pago', align: 'right', render: (r) => money(r.paid) },
    { key: 'open', header: 'Falta', align: 'right', render: (r) => (r.status === 'ativo' ? money(r.open) : <Badge>Desistente</Badge>) },
    { key: 'h', header: 'Histórico', render: (r) => <Button size="sm" variant="ghost" icon={History} onClick={() => setHistoryOf(r)}>Ver</Button> },
  ]

  return (
    <>
      <PageHeader icon={CalendarClock} section="Financeiro" title="Mensalidades"
        description="Parcelas de cada aluno, pagamentos recebidos e quem está em atraso. O total aparece no Painel para todo mundo."
        actions={isAdmin || !connected ? <>
          {isAdmin && <Button icon={RefreshCw} onClick={() => setGenerating(true)} disabled={source !== 'banco'}>Gerar parcelas</Button>}
          <Button variant="primary" icon={HandCoins} onClick={() => setPaying({})} disabled={!connected}>Registrar pagamento</Button>
        </> : undefined} />
      {notice && <StageNotice>{notice}</StageNotice>}
      {connected && !canReadAll ? null : <>
      <StatRow className="mb-6" items={[
        { icon: Wallet, label: 'Total recebido', value: money(totalRaised(payments.data)), tone: 'ok', note: `${money(totalRaised(payments.data.filter((p) => p.paidAt.startsWith(month))))} neste mês` },
        { icon: AlertTriangle, label: 'Em atraso', value: money(d.lateAmount), tone: d.lateCount ? 'bad' : 'default',
          note: d.lateCount ? `${d.lateCount} ${d.lateCount === 1 ? 'parcela' : 'parcelas'} de ${d.lateStudents} ${d.lateStudents === 1 ? 'aluno' : 'alunos'}` : 'Ninguém em atraso',
          info: 'Parcelas vencidas e não quitadas de alunos ativos, já com o adicional por atraso.' },
        { icon: ListChecks, label: 'A receber', value: money(d.openAmount), note: 'Parcelas em aberto, inclusive futuras' },
        { icon: CircleCheck, label: 'Parcelas pagas', value: `${d.paidCount} de ${instRows.filter((r) => r.active).length}` },
      ]} />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Segmented label="Visualização" options={['Parcelas', 'Pagamentos', 'Por aluno']} value={tab} onChange={setTab} />
        <p className="text-[13px] text-muted">
          {money(s.monthlyFee)} · dia {s.dueDay} · {percent(s.latePenalty)} de adicional
          {s.startMonth && <> · {monthLabel(s.startMonth)} a {monthLabel(lastMonth(s.startMonth, s.months))}</>}
          {s.provisional && <Badge tone="gold">Provisório</Badge>}
        </p>
      </div>

      {tab === 'Parcelas' && <TableCard columns={instColumns} rows={instRows} rowKey={(r) => r.id} loading={loading} error={error}
        searchPlaceholder="Buscar aluno" filters={['Todas', 'Atrasadas', 'Parciais', 'A vencer', 'Pagas']}
        matches={(r, q, f) => (!q || r.studentName.toLowerCase().includes(q))
          && (f === 'Todas' || ({ Atrasadas: 'atrasada', Parciais: 'parcial', 'A vencer': 'pendente', Pagas: 'paga' } as Record<string, InstallmentStatus>)[f] === r.status)}
        empty={{ icon: CalendarClock, title: 'Nenhuma parcela gerada', text: 'Com as regras definitivas e o mês de início definido, use "Gerar parcelas".' }} />}

      {tab === 'Pagamentos' && <TableCard columns={payColumns} rows={payRows} rowKey={(r) => r.id} loading={loading} error={error}
        searchPlaceholder="Buscar aluno" filters={['Todos', 'Pix', 'Transferência', 'Dinheiro', 'Estornos', ...(checks.data.available ? ['A conferir'] : [])]}
        matches={(r, q, f) => (!q || r.studentName.toLowerCase().includes(q))
          && (f === 'Todos' || (f === 'Estornos' ? !!r.reversalOf || r.reversed : f === 'A conferir' ? checksBy.get(r.id)?.at(-1)?.status !== 'conferido' : METHOD_LABEL[r.method] === f))}
        empty={{ icon: HandCoins, title: 'Nenhum pagamento registrado', text: 'Cadastre os alunos primeiro. Depois, cada dinheiro recebido vira um lançamento aqui.' }} />}

      {tab === 'Por aluno' && <TableCard columns={studentColumns} rows={byStudent} rowKey={(r) => r.id} loading={loading} error={error}
        searchPlaceholder="Buscar aluno" filters={['Todos', 'Em atraso', 'Em dia']}
        matches={(r, q, f) => (!q || r.name.toLowerCase().includes(q)) && (f === 'Todos' || (f === 'Em atraso' ? r.late > 0 : r.late === 0))}
        empty={{ icon: Users, title: 'Nenhum aluno cadastrado', text: 'Cadastre os alunos na página Alunos.' }} />}
      </>}

      <PaymentForm open={!!paying} preset={paying} onClose={() => setPaying(null)} today={now} suggested={s.monthlyFee}
        students={students.data.filter((st) => st.status === 'ativo')} installments={instRows} payments={payments.data}
        onSaved={(msg) => { reloadAll(); toast(msg) }} />
      <ReverseModal open={!!reversing} title="Estornar pagamento" onClose={() => setReversing(null)}
        summary={reversing && <>{reversing.studentName}, {money(reversing.amount)} em {dateBR(reversing.paidAt)}{reversing.installmentId && ` (parcela ${reversing.installmentLabel})`}.</>}
        onConfirm={async (reason, key) => { await reversePayment(reversing!, reason, key, now); reloadAll(); toast('Estorno registrado') }} />
      <GenerateModal open={generating} onClose={() => setGenerating(false)} activeStudents={students.data.filter((st) => st.status === 'ativo').length}
        onDone={(r) => { installments.reload(); toast(`Parcelas: ${r.created} criadas, ${r.updated} atualizadas, ${r.removed} removidas`) }} />
      <StudentHistory student={historyOf} onClose={() => setHistoryOf(null)} installments={instRows} payments={payRows} refundBp={Math.round(s.refundOnWithdrawal * 10_000)} />
    </>
  )
}

// ---------------------------------------------------------------- registrar pagamento
const AUTO = '__auto', LOOSE = '__avulso'

function PaymentForm({ open, preset, onClose, today: now, suggested, students, installments, payments, onSaved }: {
  open: boolean; preset: { studentId?: string; installmentId?: string } | null; onClose: () => void; today: string; suggested: number
  students: StudentRow[]; installments: InstRow[]; payments: PaymentRow[]; onSaved: (msg: string) => void
}) {
  const [f, setF] = useState({ studentId: '', target: AUTO, amount: '', paidAt: now, method: 'pix' as PaymentMethod, note: '' })
  const [key, setKey] = useState(newKey)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open_ = (sid: string) => installments.filter((i) => i.studentId === sid && i.status !== 'paga')
  // valor sugerido: o que falta na parcela escolhida, ou a mensalidade
  const suggest = (target: string, paidAt: string) => {
    const inst = installments.find((i) => i.id === target)
    const c = inst ? maxPayment(inst, payments, paidAt, now) : suggested
    return (c / 100).toFixed(2).replace('.', ',')
  }
  // nova chave a cada abertura: o mesmo formulário enviado duas vezes é recusado pelo banco
  useEffect(() => {
    if (!open) return
    const sid = preset?.studentId ?? ''
    const target = preset?.installmentId ?? (sid && open_(sid).length ? AUTO : sid ? LOOSE : AUTO)
    setF({ studentId: sid, target, amount: suggest(target, now), paidAt: now, method: 'pix', note: '' })
    setKey(newKey()); setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const cents = parseMoney(f.amount)
  const openInst = f.studentId ? open_(f.studentId) : []
  const chosen = installments.find((i) => i.id === f.target)
  const limit = chosen ? maxPayment(chosen, payments, f.paidAt, now) : null
  const plan = f.target === AUTO && cents ? distribute(cents, openInst, payments, f.paidAt, now) : null

  function setStudent(sid: string) {
    const target = open_(sid).length ? AUTO : LOOSE
    setF({ ...f, studentId: sid, target, amount: suggest(target, f.paidAt) })
  }
  function setTarget(target: string) { setF({ ...f, target, amount: suggest(target, f.paidAt) }) }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!f.studentId) { setError('Escolha o aluno.'); return }
    if (cents === null) { setError('Valor inválido. Use, por exemplo, 100 ou 75,50.'); return }
    if (f.paidAt > now) { setError('A data não pode ser no futuro.'); return }
    if (limit !== null && cents > limit) { setError(`A parcela aceita no máximo ${money(limit)} nessa data.`); return }
    if (plan && plan.leftover > 0) { setError(`Sobram ${money(plan.leftover)} além das parcelas em aberto. Registre a diferença como avulso.`); return }
    if (f.target === AUTO && !openInst.length) { setError('Esse aluno não tem parcelas em aberto. Escolha "Sem parcela (avulso)".'); return }
    setBusy(true); setError(null)
    try {
      if (f.target === AUTO) {
        const n = await createDistributedPayment({ studentId: f.studentId, amount: cents, paidAt: f.paidAt, method: f.method, note: f.note, idempotencyKey: key })
        onSaved(n > 1 ? `Pagamento dividido em ${n} parcelas` : 'Pagamento registrado')
      } else {
        await createPayment({ studentId: f.studentId, installmentId: f.target === LOOSE ? null : f.target, amount: cents, paidAt: f.paidAt, method: f.method, note: f.note, idempotencyKey: key })
        onSaved(chosen && cents < limit! ? 'Pagamento parcial registrado' : 'Pagamento registrado')
      }
      onClose()
    } catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar pagamento" description="Confira o valor antes de salvar. Lançamentos não podem ser editados, só estornados."
      footer={<>
        {error && <p role="alert" className="mr-auto text-sm text-bad">{error}</p>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" type="submit" form="payment-form" loading={busy}>{cents ? `Salvar ${money(cents)}` : 'Salvar'}</Button>
      </>}>
      <form id="payment-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Aluno" hint={students.length ? undefined : 'Cadastre um aluno na página Alunos primeiro'}>
            {(id) => <Select id={id} required value={f.studentId} onChange={(e) => setStudent(e.target.value)}>
              <option value="" disabled>Selecione</option>
              {students.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
            </Select>}
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Parcela" hint={chosen ? `${STATUS[chosen.status].label}. Aceita até ${money(limit ?? 0)} nesta data${chosen.penalty || (f.paidAt > chosen.dueDate) ? ', com o adicional por atraso' : ''}.` : f.target === LOOSE ? 'Entra no total do aluno sem quitar parcela.' : undefined}>
            {(id) => <Select id={id} value={f.target} onChange={(e) => setTarget(e.target.value)} disabled={!f.studentId}>
              {openInst.length > 0 && <option value={AUTO}>Distribuir nas parcelas em aberto (mais antiga primeiro)</option>}
              {openInst.map((i) => <option key={i.id} value={i.id}>Parcela {i.number}/{i.total} · vence {dateBR(i.dueDate)} · falta {money(i.remaining)}</option>)}
              <option value={LOOSE}>Sem parcela (avulso)</option>
            </Select>}
          </Field>
        </div>
        <Field label="Valor recebido">{(id) => <Input id={id} prefix="R$" inputMode="decimal" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0,00" />}</Field>
        <Field label="Data">{(id) => <Input id={id} type="date" required max={now} value={f.paidAt} onChange={(e) => setF({ ...f, paidAt: e.target.value })} />}</Field>
        <Field label="Forma">
          {(id) => <Select id={id} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value as PaymentMethod })}>
            {Object.entries(METHOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>}
        </Field>
        <Field label="Observação" hint="Opcional">{(id) => <Input id={id} maxLength={300} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />}</Field>
        {plan && plan.parts.length > 0 && (
          <div className="sm:col-span-2 rounded-md bg-raised ring-1 ring-line p-3 text-[13px]">
            <p className="font-medium mb-1.5">Como o valor será dividido</p>
            <ul className="space-y-1 num">
              {plan.parts.map((p) => <li key={p.installment.id} className="flex justify-between gap-3"><span className="text-muted">Parcela {p.installment.number} · {dateBR(p.installment.dueDate)}</span><span>{money(p.amount)}{p.amount < maxPayment(p.installment, payments, f.paidAt, now) && <span className="text-faint"> (parcial)</span>}</span></li>)}
            </ul>
            {plan.leftover > 0 && <p className="text-bad mt-2">Sobram {money(plan.leftover)}: passa do total em aberto.</p>}
          </div>
        )}
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------- gerar parcelas
function GenerateModal({ open, onClose, activeStudents, onDone }: {
  open: boolean; onClose: () => void; activeStudents: number; onDone: (r: { created: number; updated: number; removed: number }) => void
}) {
  const { settings: s } = useSettingsState()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (open) setError(null) }, [open])
  const blocked = s.provisional ? 'As regras ainda estão provisórias. Desmarque "Regras ainda provisórias" em Configurações quando estiverem fechadas.'
    : !s.startMonth ? 'Defina o mês da primeira parcela em Configurações.' : !activeStudents ? 'Não há alunos ativos.' : null

  async function run() {
    setBusy(true); setError(null)
    try { onDone(await syncInstallments()); onClose() }
    catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Gerar parcelas" description="Cria as mensalidades de cada aluno ativo pelas regras vigentes. Pode rodar de novo sem duplicar."
      footer={<>
        {error && <p role="alert" className="mr-auto text-sm text-bad">{error}</p>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" icon={RefreshCw} loading={busy} disabled={!!blocked} onClick={() => void run()}>Gerar</Button>
      </>}>
      {blocked ? <p className="text-sm text-warn">{blocked}</p> : (
        <div className="space-y-3 text-sm">
          <p><b className="num">{activeStudents}</b> {activeStudents === 1 ? 'aluno ativo' : 'alunos ativos'} × <b className="num">{s.months}</b> parcelas de <b className="num">{money(s.monthlyFee)}</b>,
            vencendo todo dia <b>{s.dueDay}</b>, de <b>{monthLabel(s.startMonth!)}</b> a <b>{monthLabel(lastMonth(s.startMonth!, s.months))}</b>.</p>
          <ul className="list-disc pl-5 text-[13px] text-muted space-y-1">
            <li>Parcelas que já existem não são duplicadas.</li>
            <li>Parcelas futuras sem nenhum pagamento recebem o valor e o vencimento atuais.</li>
            <li>Parcelas vencidas ou com pagamento nunca mudam.</li>
            <li>{s.newJoinersPayPast ? 'Quem entrou depois também recebe as parcelas que já venceram.' : 'Quem entrou depois paga a partir do mês de adesão.'}</li>
            <li>Desistentes perdem as parcelas futuras ainda sem pagamento.</li>
          </ul>
        </div>
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------- histórico do aluno
function StudentHistory({ student, onClose, installments, payments, refundBp }: {
  student: StudentRow | null; onClose: () => void; installments: InstRow[]; payments: PayRow[]; refundBp: number
}) {
  if (!student) return null
  const mine = installments.filter((i) => i.studentId === student.id)
  const pays = payments.filter((p) => p.studentId === student.id)
  const paid = pays.reduce((a, p) => a + p.amount, 0)
  const r = refundOnWithdrawal(paid, refundBp)
  return (
    <Modal wide open onClose={onClose} title={student.name}
      description={<>Adesão em {dateBR(student.joinedAt)} · {student.status === 'ativo' ? 'Ativo' : 'Desistente'} · total pago <b className="text-ink num">{money(paid)}</b></>}>
      {student.status === 'desistente' && paid > 0 && (
        <p className="rounded-md bg-warn/10 text-[13px] px-3 py-2 mb-4">Pela regra vigente ({percent(refundBp / 10_000)}), a devolução prevista é de <b className="num">{money(r.refund)}</b> e ficam retidos <b className="num">{money(r.retained)}</b>. Registre a devolução em Despesas, categoria "Devolução a desistente".</p>
      )}
      <h3 className="text-[13px] font-semibold mb-2">Parcelas</h3>
      {mine.length ? <div className="overflow-x-auto mb-6"><table className="w-full text-sm num">
        <thead><tr className="text-xs text-faint border-b border-line"><th className="text-left font-medium py-2">Nº</th><th className="text-left font-medium">Vencimento</th><th className="text-right font-medium">Valor</th><th className="text-right font-medium">Adicional</th><th className="text-right font-medium">Pago</th><th className="text-right font-medium">Falta</th><th className="text-right font-medium pl-3">Situação</th></tr></thead>
        <tbody>{mine.map((i) => (
          <tr key={i.id} className="border-b border-line/60 last:border-0">
            <td className="py-2">{i.number}</td><td>{dateBR(i.dueDate)}</td><td className="text-right">{moneyShort(i.amount)}</td>
            <td className="text-right">{i.penalty ? money(i.penalty) : '—'}</td><td className="text-right">{money(i.paid)}</td>
            <td className="text-right">{i.remaining ? money(i.remaining) : '—'}</td><td className="text-right pl-3"><Badge tone={STATUS[i.status].tone}>{STATUS[i.status].label}</Badge></td>
          </tr>))}</tbody>
      </table></div> : <p className="text-sm text-muted mb-6">Nenhuma parcela gerada.</p>}
      <h3 className="text-[13px] font-semibold mb-2">Pagamentos</h3>
      {pays.length ? <ul className="divide-y divide-line/60 text-sm">
        {pays.map((p) => (
          <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2 num">
            <span>{dateBR(p.paidAt)} · {METHOD_LABEL[p.method]} · parcela {p.installmentLabel}{p.note && <span className="text-muted"> · {p.note}</span>}</span>
            <span className={p.amount < 0 ? 'text-bad' : ''}>{money(p.amount)}{p.reversed && <span className="text-faint"> (estornado)</span>}</span>
          </li>))}
      </ul> : <p className="text-sm text-muted">Nenhum pagamento registrado.</p>}
    </Modal>
  )
}
