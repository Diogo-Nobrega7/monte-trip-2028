import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarClock, CircleCheck, HandCoins, Undo2, Users, Wallet } from 'lucide-react'
import { ListPage } from '@/components/patterns/ListPage'
import { Badge, Button, Card, CardHeader, Field, Input, Modal, Select, useToast } from '@/components/ui'
import { useSettings } from '@/app/SettingsContext'
import { useAuth } from '@/data/auth'
import { connected } from '@/data/supabase'
import {
  METHOD_LABEL, createPayment, listPayments, listStudents, reversePayment,
  type PaymentMethod, type PaymentRow, type StudentRow,
} from '@/data/repo'
import { dateBR, newKey, today, useRemote } from '@/data/useRemote'
import { money, moneyShort, percent } from '@/lib/format'
import { parseMoney, reversedIds, totalRaised } from '@/lib/payments'
import { accessNotice } from '../stage'

type Row = PaymentRow & { studentName: string; reversed: boolean }

/**
 * Pagamentos recebidos dos alunos. Lançamentos não são editados nem apagados:
 * um erro se corrige com estorno (valor oposto) e, se preciso, um novo lançamento.
 */
export function InstallmentsPage() {
  const s = useSettings()
  const { canReadAll, isAdmin } = useAuth()
  const toast = useToast()
  const enabled = connected && canReadAll
  const students = useRemote(listStudents, enabled, [])
  const payments = useRemote(listPayments, enabled, [])
  const [open, setOpen] = useState(false)
  const [reversing, setReversing] = useState<Row | null>(null)

  const rows: Row[] = useMemo(() => {
    const names = new Map(students.data.map((st) => [st.id, st.name]))
    const rev = reversedIds(payments.data)
    return payments.data.map((p) => ({ ...p, studentName: names.get(p.studentId) ?? '—', reversed: rev.has(p.id) }))
  }, [students.data, payments.data])

  const month = today().slice(0, 7)
  const inMonth = payments.data.filter((p) => p.paidAt.startsWith(month))

  return (
    <>
      <ListPage<Row>
        icon={CalendarClock} section="Financeiro" title="Pagamentos"
        description="Cada vez que um aluno manda dinheiro, registre aqui. O total aparece no Painel para todo mundo."
        createLabel="Registrar pagamento" onCreate={() => setOpen(true)} canCreate={isAdmin || !connected}
        notice={accessNotice(connected, canReadAll) ?? students.error ?? payments.error}
        loading={students.loading || payments.loading}
        metrics={[
          { icon: Wallet, label: 'Total recebido', value: money(totalRaised(payments.data)), tone: 'ok' },
          { icon: CircleCheck, label: 'Recebido no mês', value: money(totalRaised(inMonth)) },
          { icon: HandCoins, label: 'Lançamentos', value: payments.data.filter((p) => !p.reversalOf).length },
          { icon: Users, label: 'Alunos ativos', value: students.data.filter((st) => st.status === 'ativo').length },
        ]}
        searchPlaceholder="Buscar aluno" filters={['Todos', 'Pix', 'Transferência', 'Dinheiro', 'Estornos']}
        rows={rows} rowKey={(r) => r.id}
        matches={(r, q, f) => (!q || r.studentName.toLowerCase().includes(q))
          && (f === 'Todos' || (f === 'Estornos' ? !!r.reversalOf || r.reversed : METHOD_LABEL[r.method] === f))}
        columns={[
          { key: 'student', header: 'Aluno', primary: true, render: (r) => <span className="font-medium">{r.studentName}</span> },
          { key: 'date', header: 'Data', render: (r) => dateBR(r.paidAt) },
          { key: 'amount', header: 'Valor', align: 'right', render: (r) => <span className={r.amount < 0 ? 'text-bad' : ''}>{money(r.amount)}</span> },
          { key: 'method', header: 'Forma', hideOnMobile: true, render: (r) => METHOD_LABEL[r.method] },
          { key: 'note', header: 'Observação', hideOnMobile: true, render: (r) => <span className="text-muted">{r.note ?? ''}</span> },
          { key: 'status', header: 'Situação', render: (r) => (
            r.reversalOf ? <Badge tone="bad">Estorno</Badge>
            : r.reversed ? <Badge tone="neutral">Estornado</Badge>
            : <span className="inline-flex items-center gap-2"><Badge dot tone="ok">Recebido</Badge>
                {isAdmin && <Button size="sm" variant="ghost" icon={Undo2} onClick={() => setReversing(r)}>Estornar</Button>}</span>
          ) },
        ]}
        empty={{ icon: CalendarClock, title: 'Nenhum pagamento registrado', text: 'Cadastre os alunos primeiro. Depois, cada dinheiro recebido vira um lançamento aqui.' }}
        aside={
          <Card>
            <CardHeader title="Regras em vigor" hint="Propostas, aguardando aprovação" action={<Badge tone="gold">Provisório</Badge>} />
            <dl className="px-5 pb-5 text-sm divide-y divide-line">
              {[['Valor sugerido', moneyShort(s.monthlyFee)], ['Vencimento', `Todo dia ${s.dueDay}`], ['Adicional por atraso', percent(s.latePenalty)], ['Parcelas', String(s.months)]].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2.5 first:pt-0 last:pb-0"><dt className="text-muted">{k}</dt><dd className="num font-medium">{v}</dd></div>
              ))}
            </dl>
          </Card>
        }
      />
      <PaymentForm open={open} onClose={() => setOpen(false)} students={students.data.filter((st) => st.status === 'ativo')}
        suggested={s.monthlyFee} onSaved={() => { payments.reload(); toast('Pagamento registrado') }} />
      <ReverseForm payment={reversing} onClose={() => setReversing(null)} onSaved={() => { payments.reload(); toast('Estorno registrado') }} />
    </>
  )
}

function PaymentForm({ open, onClose, students, suggested, onSaved }: {
  open: boolean; onClose: () => void; students: StudentRow[]; suggested: number; onSaved: () => void
}) {
  const fresh = () => ({ studentId: '', amount: (suggested / 100).toFixed(2).replace('.', ','), paidAt: today(), method: 'pix' as PaymentMethod, note: '' })
  const [f, setF] = useState(fresh)
  const [key, setKey] = useState(newKey)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // nova chave a cada abertura: o mesmo formulário enviado duas vezes é recusado pelo banco
  useEffect(() => { if (open) { setKey(newKey()); setError(null) } }, [open])
  const set = (k: keyof ReturnType<typeof fresh>) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const cents = parseMoney(f.amount)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!f.studentId) { setError('Escolha o aluno.'); return }
    if (cents === null) { setError('Valor inválido. Use, por exemplo, 100 ou 75,50.'); return }
    setBusy(true); setError(null)
    try {
      await createPayment({ studentId: f.studentId, amount: cents, paidAt: f.paidAt, method: f.method, note: f.note, idempotencyKey: key })
      setF(fresh()); onClose(); onSaved()
    } catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar pagamento" description="Confira o valor antes de salvar. Lançamentos não podem ser editados, só estornados."
      footer={<>
        {error && <p role="alert" className="mr-auto text-sm text-bad">{error}</p>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" type="submit" form="payment-form" loading={busy}>
          {cents ? `Salvar ${money(cents)}` : 'Salvar'}
        </Button>
      </>}>
      <form id="payment-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Aluno" hint={students.length ? undefined : 'Cadastre um aluno na página Alunos primeiro'}>
            {(id) => <Select id={id} required value={f.studentId} onChange={set('studentId')}>
              <option value="" disabled>Selecione</option>
              {students.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
            </Select>}
          </Field>
        </div>
        <Field label="Valor recebido">{(id) => <Input id={id} prefix="R$" inputMode="decimal" required value={f.amount} onChange={set('amount')} placeholder="0,00" />}</Field>
        <Field label="Data">{(id) => <Input id={id} type="date" required max={today()} value={f.paidAt} onChange={set('paidAt')} />}</Field>
        <Field label="Forma">
          {(id) => <Select id={id} value={f.method} onChange={set('method')}>
            {Object.entries(METHOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>}
        </Field>
        <Field label="Observação" hint="Opcional, ex.: parcela de março">{(id) => <Input id={id} maxLength={300} value={f.note} onChange={set('note')} />}</Field>
      </form>
    </Modal>
  )
}

function ReverseForm({ payment, onClose, onSaved }: { payment: Row | null; onClose: () => void; onSaved: () => void }) {
  const [reason, setReason] = useState('')
  const [key, setKey] = useState(newKey)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (payment) { setKey(newKey()); setReason(''); setError(null) } }, [payment])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!payment) return
    setBusy(true); setError(null)
    try { await reversePayment(payment, reason || 'Estorno', key); onClose(); onSaved() }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <Modal open={!!payment} onClose={onClose} title="Estornar pagamento"
      description={payment ? `${payment.studentName}, ${money(payment.amount)} em ${dateBR(payment.paidAt)}. O lançamento original continua no histórico.` : ''}
      footer={<>
        {error && <p role="alert" className="mr-auto text-sm text-bad">{error}</p>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" type="submit" form="reverse-form" loading={busy}>Confirmar estorno</Button>
      </>}>
      <form id="reverse-form" onSubmit={submit}>
        <Field label="Motivo" hint="Ex.: valor digitado errado, aluno errado">{(id) => <Input id={id} required maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
      </form>
    </Modal>
  )
}
