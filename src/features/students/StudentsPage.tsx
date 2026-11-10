import { useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, UserMinus, Users, Wallet } from 'lucide-react'
import { ListPage } from '@/components/patterns/ListPage'
import { Badge, Button, Field, Input, Modal, useToast, type Tone } from '@/components/ui'
import { useSettings } from '@/app/SettingsContext'
import { useAuth } from '@/data/auth'
import { connected } from '@/data/supabase'
import { createStudent, listPayments, listStudents, setStudentStatus, type StudentRow } from '@/data/repo'
import { dateBR, today, useRemote } from '@/data/useRemote'
import { money } from '@/lib/format'
import { totalRaised, totalsByStudent } from '@/lib/payments'
import { accessNotice } from '../stage'

const STATUS: Record<StudentRow['status'], { label: string; tone: Tone }> = {
  ativo: { label: 'Ativo', tone: 'ok' }, desistente: { label: 'Desistente', tone: 'neutral' },
}
const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()

type Row = StudentRow & { paid: number }

export function StudentsPage() {
  const s = useSettings()
  const { canReadAll, isAdmin } = useAuth()
  const toast = useToast()
  const enabled = connected && canReadAll
  const students = useRemote(listStudents, enabled, [])
  const payments = useRemote(listPayments, enabled, [])
  const [open, setOpen] = useState(false)

  const rows: Row[] = useMemo(() => {
    const t = totalsByStudent(payments.data)
    return students.data.map((st) => ({ ...st, paid: t.get(st.id) ?? 0 }))
  }, [students.data, payments.data])
  const active = rows.filter((r) => r.status === 'ativo').length

  async function toggle(r: Row) {
    const next = r.status === 'ativo' ? 'desistente' : 'ativo'
    if (next === 'desistente' && !confirm(`Marcar ${r.name} como desistente? O histórico de pagamentos continua guardado.`)) return
    try { await setStudentStatus(r.id, next); toast('Situação atualizada'); students.reload() }
    catch (e) { toast((e as Error).message, 'error') }
  }

  return (
    <>
      <ListPage<Row>
        icon={Users} section="Organização" title="Alunos"
        description="Quem aderiu à viagem, quanto já pagou e o responsável legal de cada um."
        createLabel="Cadastrar aluno" onCreate={() => setOpen(true)} canCreate={isAdmin || !connected}
        notice={accessNotice(connected, canReadAll) ?? students.error ?? payments.error}
        loading={students.loading || payments.loading}
        metrics={[
          { icon: Users, label: 'Ativos', value: `${active} de ${s.expectedStudents}` },
          { icon: Wallet, label: 'Total pago', value: money(totalRaised(payments.data)), tone: 'ok' },
          { icon: CheckCircle2, label: 'Já pagaram algo', value: rows.filter((r) => r.paid > 0).length },
          { icon: UserMinus, label: 'Desistências', value: rows.length - active },
        ]}
        searchPlaceholder="Buscar aluno" filters={['Todos', ...Object.values(STATUS).map((x) => x.label)]}
        rows={rows} rowKey={(r) => r.id}
        matches={(r, q, f) => (!q || `${r.name} ${r.guardianName ?? ''}`.toLowerCase().includes(q)) && (f === 'Todos' || STATUS[r.status].label === f)}
        columns={[
          { key: 'name', header: 'Aluno', primary: true, render: (r) => (
            <span className="flex items-center gap-3"><span className="grid place-items-center size-8 rounded-full bg-accent/10 text-accent text-xs font-semibold">{initials(r.name)}</span><span className="font-medium">{r.name}</span></span>
          ) },
          { key: 'guardian', header: 'Responsável', render: (r) => r.guardianName ?? '—' },
          { key: 'contact', header: 'Contato', hideOnMobile: true, render: (r) => r.guardianContact ?? '—' },
          { key: 'joined', header: 'Adesão', hideOnMobile: true, render: (r) => dateBR(r.joinedAt) },
          { key: 'paid', header: 'Pago', align: 'right', render: (r) => money(r.paid) },
          { key: 'status', header: 'Situação', render: (r) => (
            <span className="inline-flex items-center gap-2">
              <Badge dot tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
              {isAdmin && <Button size="sm" variant="ghost" onClick={() => void toggle(r)}>{r.status === 'ativo' ? 'Desistiu' : 'Reativar'}</Button>}
            </span>
          ) },
        ]}
        empty={{ icon: Users, title: 'Nenhum aluno cadastrado', text: 'Cadastre cada aluno com o responsável legal. Dados de menores ficam visíveis apenas para a administração.' }}
      />
      <StudentForm open={open} onClose={() => setOpen(false)} onSaved={() => { students.reload(); toast('Aluno cadastrado') }} />
    </>
  )
}

function StudentForm({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const empty = { name: '', guardianName: '', guardianContact: '', joinedAt: today() }
  const [f, setF] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (f.name.trim().length < 2) { setError('Informe o nome do aluno.'); return }
    setBusy(true); setError(null)
    try { await createStudent(f); setF(empty); onClose(); onSaved() }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Cadastrar aluno" description="Só a administração vê esses dados."
      footer={<>
        {error && <p role="alert" className="mr-auto text-sm text-bad">{error}</p>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" type="submit" form="student-form" loading={busy}>Salvar</Button>
      </>}>
      <form id="student-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Nome do aluno">{(id) => <Input id={id} required maxLength={120} value={f.name} onChange={set('name')} placeholder="Nome completo" />}</Field></div>
        <Field label="Responsável legal">{(id) => <Input id={id} maxLength={120} value={f.guardianName} onChange={set('guardianName')} placeholder="Nome completo" />}</Field>
        <Field label="Contato do responsável" hint="Telefone ou e-mail">{(id) => <Input id={id} maxLength={120} value={f.guardianContact} onChange={set('guardianContact')} />}</Field>
        <Field label="Data de adesão">{(id) => <Input id={id} type="date" required value={f.joinedAt} onChange={set('joinedAt')} />}</Field>
      </form>
    </Modal>
  )
}
