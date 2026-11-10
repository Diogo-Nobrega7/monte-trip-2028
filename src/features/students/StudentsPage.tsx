import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, FileSpreadsheet, History, Pencil, Upload, UserMinus, Users, Wallet } from 'lucide-react'
import { ListPage } from '@/components/patterns/ListPage'
import { AuditModal } from '@/components/patterns/AuditModal'
import { Badge, Button, Field, Input, Modal, useToast, type Tone } from '@/components/ui'
import { useSettings } from '@/app/SettingsContext'
import { useAuth } from '@/data/auth'
import { connected } from '@/data/supabase'
import { createStudent, createStudents, listPayments, listStudents, setStudentStatus, updateStudent, type StudentInput, type StudentRow } from '@/data/repo'
import { readTable } from '@/data/spreadsheet'
import { dateBR, today, useRemote } from '@/data/useRemote'
import { money, percent } from '@/lib/format'
import { importable, parseStudentRows, type ImportRow } from '@/lib/import'
import { refundOnWithdrawal } from '@/lib/installments'
import { totalRaised, totalsByStudent } from '@/lib/payments'
import { accessNotice } from '../stage'

const STATUS: Record<StudentRow['status'], { label: string; tone: Tone }> = {
  ativo: { label: 'Ativo', tone: 'ok' }, desistente: { label: 'Desistente', tone: 'neutral' },
}
const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
const AUDIT_LABELS = { nome: 'Nome', responsavel_nome: 'Responsável', responsavel_contato: 'Contato', adesao_em: 'Adesão', status: 'Situação' }

type Row = StudentRow & { paid: number }

export function StudentsPage() {
  const s = useSettings()
  const { canReadAll, isAdmin } = useAuth()
  const toast = useToast()
  const enabled = connected && canReadAll
  const students = useRemote(listStudents, enabled, [])
  const payments = useRemote(listPayments, enabled, [])
  const [form, setForm] = useState<{ edit: Row | null } | null>(null)
  const [importing, setImporting] = useState(false)
  const [withdrawing, setWithdrawing] = useState<Row | null>(null)
  const [audit, setAudit] = useState<Row | null>(null)

  const rows: Row[] = useMemo(() => {
    const t = totalsByStudent(payments.data)
    return students.data.map((st) => ({ ...st, paid: t.get(st.id) ?? 0 }))
  }, [students.data, payments.data])
  const active = rows.filter((r) => r.status === 'ativo').length

  async function reactivate(r: Row) {
    try { await setStudentStatus(r.id, 'ativo'); toast(`${r.name} reativado`); students.reload() }
    catch (e) { toast((e as Error).message, 'error') }
  }

  return (
    <>
      <ListPage<Row>
        icon={Users} section="Organização" title="Alunos"
        description="Quem aderiu à viagem, quanto já pagou e o responsável legal de cada um."
        createLabel="Cadastrar aluno" onCreate={() => setForm({ edit: null })} canCreate={isAdmin}
        actions={isAdmin && <Button icon={Upload} onClick={() => setImporting(true)}>Importar planilha</Button>}
        locked={connected && !canReadAll}
        notice={accessNotice(connected, canReadAll)}
        loading={students.loading || payments.loading} error={students.error ?? payments.error}
        metrics={[
          { icon: Users, label: 'Ativos', value: `${active} de ${s.expectedStudents}` },
          { icon: Wallet, label: 'Total pago', value: money(totalRaised(payments.data)), tone: 'ok' },
          { icon: CheckCircle2, label: 'Já pagaram algo', value: rows.filter((r) => r.paid > 0).length },
          { icon: UserMinus, label: 'Desistências', value: rows.length - active },
        ]}
        searchPlaceholder="Buscar aluno ou responsável" filters={['Todos', ...Object.values(STATUS).map((x) => x.label)]}
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
            <span className="inline-flex flex-wrap items-center gap-1">
              <Badge dot tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
              {isAdmin && <Button size="sm" variant="ghost" icon={Pencil} aria-label={`Editar ${r.name}`} onClick={() => setForm({ edit: r })} />}
              <Button size="sm" variant="ghost" icon={History} aria-label={`Histórico de ${r.name}`} onClick={() => setAudit(r)} />
              {isAdmin && (r.status === 'ativo'
                ? <Button size="sm" variant="ghost" onClick={() => setWithdrawing(r)}>Desistiu</Button>
                : <Button size="sm" variant="ghost" onClick={() => void reactivate(r)}>Reativar</Button>)}
            </span>
          ) },
        ]}
        empty={{ icon: Users, title: 'Nenhum aluno cadastrado', text: 'Cadastre cada aluno com o responsável legal, ou importe uma planilha. Dados de menores ficam visíveis apenas para a administração.' }}
      />
      <StudentForm open={!!form} edit={form?.edit ?? null} onClose={() => setForm(null)}
        onSaved={(msg) => { students.reload(); toast(msg) }} />
      <ImportModal open={importing} onClose={() => setImporting(false)} existing={students.data.map((x) => x.name)}
        onSaved={(n) => { students.reload(); toast(`${n} ${n === 1 ? 'aluno importado' : 'alunos importados'}`) }} />
      <WithdrawModal student={withdrawing} refundBp={Math.round(s.refundOnWithdrawal * 10_000)} onClose={() => setWithdrawing(null)}
        onSaved={() => { students.reload(); toast('Situação atualizada') }} />
      <AuditModal table="students" id={audit?.id ?? null} title={audit ? `Histórico de ${audit.name}` : ''} labels={AUDIT_LABELS} onClose={() => setAudit(null)} />
    </>
  )
}

function StudentForm({ open, edit, onClose, onSaved }: { open: boolean; edit: Row | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const [f, setF] = useState<StudentInput>({ name: '', guardianName: '', guardianContact: '', joinedAt: today() })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    setF(edit ? { name: edit.name, guardianName: edit.guardianName ?? '', guardianContact: edit.guardianContact ?? '', joinedAt: edit.joinedAt }
      : { name: '', guardianName: '', guardianContact: '', joinedAt: today() })
    setError(null)
  }, [open, edit])
  const set = (k: keyof StudentInput) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (f.name.trim().length < 2) { setError('Informe o nome do aluno.'); return }
    if (f.joinedAt > today()) { setError('A data de adesão não pode ser no futuro.'); return }
    setBusy(true); setError(null)
    try {
      if (edit) await updateStudent(edit.id, f); else await createStudent(f)
      onClose(); onSaved(edit ? 'Cadastro atualizado' : 'Aluno cadastrado')
    } catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={edit ? 'Editar cadastro' : 'Cadastrar aluno'}
      description={edit ? 'Corrige dados de cadastro. A alteração fica no histórico do aluno.' : 'Só a administração vê esses dados.'}
      footer={<>
        {error && <p role="alert" className="mr-auto text-sm text-bad">{error}</p>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" type="submit" form="student-form" loading={busy}>Salvar</Button>
      </>}>
      <form id="student-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Nome do aluno">{(id) => <Input id={id} required maxLength={120} value={f.name} onChange={set('name')} placeholder="Nome completo" />}</Field></div>
        <Field label="Responsável legal">{(id) => <Input id={id} maxLength={120} value={f.guardianName} onChange={set('guardianName')} placeholder="Nome completo" />}</Field>
        <Field label="Contato do responsável" hint="Telefone ou e-mail">{(id) => <Input id={id} maxLength={120} value={f.guardianContact} onChange={set('guardianContact')} />}</Field>
        <Field label="Data de adesão">{(id) => <Input id={id} type="date" required max={today()} value={f.joinedAt} onChange={set('joinedAt')} />}</Field>
      </form>
    </Modal>
  )
}

function WithdrawModal({ student, refundBp, onClose, onSaved }: { student: Row | null; refundBp: number; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => setError(null), [student])
  if (!student) return null
  const r = refundOnWithdrawal(student.paid, refundBp)
  async function confirmIt() {
    setBusy(true); setError(null)
    try { await setStudentStatus(student!.id, 'desistente'); onClose(); onSaved() }
    catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={`${student.name} desistiu?`}
      description="O histórico de pagamentos continua guardado. Parcelas futuras ainda sem pagamento deixam de ser cobradas na próxima geração de parcelas."
      footer={<>
        {error && <p role="alert" className="mr-auto text-sm text-bad">{error}</p>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={busy} onClick={() => void confirmIt()}>Confirmar desistência</Button>
      </>}>
      <dl className="grid grid-cols-3 gap-3 text-sm num">
        <div className="rounded-md bg-raised p-3"><dt className="text-xs text-faint">Pago até hoje</dt><dd className="font-semibold mt-1">{money(student.paid)}</dd></div>
        <div className="rounded-md bg-raised p-3"><dt className="text-xs text-faint">Devolução ({percent(refundBp / 10_000)})</dt><dd className="font-semibold mt-1">{money(r.refund)}</dd></div>
        <div className="rounded-md bg-raised p-3"><dt className="text-xs text-faint">Retido</dt><dd className="font-semibold mt-1">{money(r.retained)}</dd></div>
      </dl>
      <p className="text-[13px] text-muted mt-4">Pela regra vigente em Configurações. Quando devolver o dinheiro, registre em Despesas, categoria "Devolução a desistente".</p>
    </Modal>
  )
}

function ImportModal({ open, onClose, existing, onSaved }: { open: boolean; onClose: () => void; existing: string[]; onSaved: (n: number) => void }) {
  const [rows, setRows] = useState<ImportRow[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (open) { setRows(null); setFileName(''); setError(null) } }, [open])
  const ok = rows ? importable(rows) : []

  async function pick(file: File | undefined) {
    if (!file) return
    setError(null); setRows(null); setFileName(file.name)
    if (file.size > 2 * 1024 * 1024) { setError('Planilha maior que 2 MB.'); return }
    try {
      const table = await readTable(file)
      const parsed = parseStudentRows(table, existing, today())
      if (parsed.missingName) { setError('Não achei a coluna com o nome do aluno. A primeira linha precisa ter um título como "Nome" ou "Aluno".'); return }
      if (!parsed.rows.length) { setError('A planilha não tem linhas de alunos.'); return }
      if (parsed.rows.length > 300) { setError('Mais de 300 linhas. Divida a planilha.'); return }
      setRows(parsed.rows)
    } catch (e) { setError((e as Error).message || 'Não foi possível ler a planilha.') }
  }

  async function save() {
    if (!ok.length) return
    setBusy(true); setError(null)
    try { await createStudents(ok); onClose(); onSaved(ok.length) }
    catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <Modal wide open={open} onClose={onClose} title="Importar alunos de planilha"
      description="Excel (.xlsx) ou CSV. Primeira linha com títulos: Nome (obrigatório), Responsável, Contato e Data de adesão. Nada é gravado antes de você confirmar."
      footer={<>
        {error && <p role="alert" className="mr-auto text-sm text-bad">{error}</p>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={busy} disabled={!ok.length} onClick={() => void save()}>
          {ok.length ? `Importar ${ok.length} ${ok.length === 1 ? 'aluno' : 'alunos'}` : 'Importar'}
        </Button>
      </>}>
      <label className="flex items-center gap-3 rounded-md border border-dashed border-line px-4 py-4 cursor-pointer hover:bg-raised">
        <FileSpreadsheet size={20} className="text-accent shrink-0" aria-hidden />
        <span className="text-sm flex-1">{fileName || 'Escolher planilha'}<span className="block text-xs text-faint">Até 300 alunos por vez</span></span>
        <input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only"
          onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
      </label>
      {rows && <>
        <p className="text-sm mt-4 mb-2">
          <b className="num">{ok.length}</b> prontos para importar
          {rows.length - ok.length > 0 && <> · <span className="text-warn num">{rows.length - ok.length} ficam de fora</span> (erro ou duplicado)</>}
        </p>
        <div className="max-h-[45vh] overflow-auto rounded-md ring-1 ring-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-raised"><tr className="text-xs text-faint"><th className="text-left font-medium px-3 h-9">Linha</th><th className="text-left font-medium px-3">Aluno</th><th className="text-left font-medium px-3">Responsável</th><th className="text-left font-medium px-3">Adesão</th><th className="text-left font-medium px-3">Situação</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.line} className="border-t border-line/70 align-top">
                <td className="px-3 py-2 num text-faint">{r.line}</td>
                <td className="px-3 py-2">{r.name || <span className="text-faint">vazio</span>}</td>
                <td className="px-3 py-2 text-muted">{r.guardianName || '—'}</td>
                <td className="px-3 py-2 num">{dateBR(r.joinedAt)}</td>
                <td className="px-3 py-2">{r.errors.length ? <span className="text-bad text-[13px]">{r.errors.join('. ')}</span>
                  : r.duplicate ? <Badge tone="warn">{r.duplicate === 'cadastro' ? 'Já cadastrado' : 'Repetido no arquivo'}</Badge>
                  : <Badge tone="ok" dot>Pronto</Badge>}</td>
              </tr>))}</tbody>
          </table>
        </div>
      </>}
    </Modal>
  )
}
