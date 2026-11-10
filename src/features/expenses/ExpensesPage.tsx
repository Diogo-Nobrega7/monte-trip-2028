import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarDays, FileCheck2, FileWarning, History, ListOrdered, Paperclip, Pencil, Receipt, Undo2 } from 'lucide-react'
import { ListPage } from '@/components/patterns/ListPage'
import { PeriodFilter } from '@/components/patterns/PeriodFilter'
import { ReverseModal } from '@/components/patterns/ReverseModal'
import { AuditModal } from '@/components/patterns/AuditModal'
import { AttachModal, FilePicker } from '@/components/patterns/AttachModal'
import { Badge, Button, Field, Input, Modal, Select, Textarea, useToast } from '@/components/ui'
import { useAuth } from '@/data/auth'
import { connected } from '@/data/supabase'
import { CATEGORY_LABEL, createExpense, listExpenses, reverseExpense, updateExpenseText, type ExpenseCategory, type ExpenseRow } from '@/data/cash'
import { checkFile, listDocuments, openDocument, uploadDocument, type DocumentRow } from '@/data/documents'
import { dateBR, newKey, today, useRemote } from '@/data/useRemote'
import { money } from '@/lib/format'
import { parseMoney } from '@/lib/payments'
import { inRange, presetRange, type PeriodPreset } from '@/lib/period'
import { accessNotice } from '../stage'

type Row = ExpenseRow & { reversed: boolean; receipts: DocumentRow[] }
const AUDIT_LABELS = { descricao: 'Descrição', justificativa: 'Justificativa' }

/** Saídas de caixa. Valor, data e categoria nunca mudam: correção = estorno. Comprovantes no Storage privado. */
export function ExpensesPage() {
  const { canReadAll, isAdmin } = useAuth()
  const toast = useToast()
  const enabled = connected && canReadAll
  const expenses = useRemote(listExpenses, enabled, [])
  const docs = useRemote(listDocuments, enabled, [])
  const [period, setPeriod] = useState<PeriodPreset>('tudo')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [reversing, setReversing] = useState<Row | null>(null)
  const [attaching, setAttaching] = useState<Row | null>(null)
  const [audit, setAudit] = useState<Row | null>(null)
  const now = today()

  const all: Row[] = useMemo(() => {
    const rev = new Set(expenses.data.flatMap((e) => (e.reversalOf ? [e.reversalOf] : [])))
    const byExp = new Map<string, DocumentRow[]>()
    for (const d of docs.data) if (d.expenseId && !d.deletedAt) byExp.set(d.expenseId, [...(byExp.get(d.expenseId) ?? []), d])
    return expenses.data.map((e) => ({ ...e, reversed: rev.has(e.id), receipts: byExp.get(e.id) ?? [] }))
  }, [expenses.data, docs.data])
  const rows = all.filter((r) => inRange(r.date, presetRange(period, now)))
  const total = (list: Row[]) => list.reduce((s, r) => s + r.amount, 0)
  // sem comprovante: despesas válidas (não estornadas, não estornos) sem arquivo
  const missing = all.filter((r) => !r.reversalOf && !r.reversed && !r.receipts.length)

  async function view(d: DocumentRow) {
    try { await openDocument(d.path) } catch (e) { toast((e as Error).message, 'error') }
  }

  return (
    <>
      <ListPage<Row>
        icon={Receipt} section="Financeiro" title="Despesas"
        description="Toda saída de dinheiro, com categoria, justificativa e comprovante."
        createLabel="Registrar despesa" onCreate={() => setCreating(true)} canCreate={isAdmin}
        locked={connected && !canReadAll}
        notice={accessNotice(connected, canReadAll)}
        loading={expenses.loading || docs.loading} error={expenses.error ?? docs.error}
        metrics={[
          { icon: Receipt, label: period === 'tudo' ? 'Total gasto' : 'Gasto no período', value: money(total(rows)), info: 'Soma das despesas, com estornos já descontados.' },
          { icon: CalendarDays, label: 'Neste mês', value: money(total(all.filter((r) => r.date.startsWith(now.slice(0, 7))))) },
          { icon: FileWarning, label: 'Sem comprovante', value: missing.length, tone: missing.length ? 'warn' : 'default' },
          { icon: ListOrdered, label: 'Lançamentos', value: rows.filter((r) => !r.reversalOf).length },
        ]}
        extra={<PeriodFilter value={period} onChange={setPeriod} />}
        searchPlaceholder="Buscar despesa" filters={['Todas', 'Sem comprovante', 'Estornos', ...Object.values(CATEGORY_LABEL)]}
        rows={rows} rowKey={(r) => r.id}
        matches={(r, q, f) => (!q || `${r.description} ${r.justification}`.toLowerCase().includes(q))
          && (f === 'Todas' || (f === 'Sem comprovante' ? missing.includes(r) : f === 'Estornos' ? !!r.reversalOf || r.reversed : CATEGORY_LABEL[r.category] === f))}
        columns={[
          { key: 'desc', header: 'Descrição', primary: true, render: (r) => (
            <span><span className="font-medium">{r.description}</span><span className="block text-xs text-faint font-normal max-w-[28ch] truncate" title={r.justification}>{r.justification}</span></span>
          ) },
          { key: 'cat', header: 'Categoria', render: (r) => <Badge>{CATEGORY_LABEL[r.category]}</Badge> },
          { key: 'date', header: 'Data', hideOnMobile: true, render: (r) => dateBR(r.date) },
          { key: 'receipt', header: 'Comprovante', render: (r) => (
            r.reversalOf ? <span className="text-faint">—</span>
            : r.receipts.length ? <span className="inline-flex flex-wrap gap-1">{r.receipts.map((d) => (
                <button key={d.id} onClick={() => void view(d)} className="inline-flex items-center gap-1 text-[13px] text-accent hover:underline"><FileCheck2 size={14} aria-hidden />Ver</button>))}</span>
            : isAdmin && !r.reversed ? <Button size="sm" variant="ghost" icon={Paperclip} onClick={() => setAttaching(r)}>Anexar</Button>
            : <Badge dot tone="warn">Pendente</Badge>
          ) },
          { key: 'amount', header: 'Valor', align: 'right', render: (r) => <span className={r.amount < 0 ? 'text-ok' : ''}>{money(r.amount)}</span> },
          { key: 'act', header: 'Situação', render: (r) => (
            <span className="inline-flex items-center gap-1">
              {r.reversalOf ? <Badge tone="bad">Estorno</Badge> : r.reversed ? <Badge>Estornada</Badge> : null}
              {isAdmin && !r.reversalOf && <Button size="sm" variant="ghost" icon={Pencil} aria-label={`Editar ${r.description}`} onClick={() => setEditing(r)} />}
              {isAdmin && !r.reversalOf && !r.reversed && <Button size="sm" variant="ghost" icon={Undo2} onClick={() => setReversing(r)}>Estornar</Button>}
              <Button size="sm" variant="ghost" icon={History} aria-label={`Histórico de ${r.description}`} onClick={() => setAudit(r)} />
            </span>
          ) },
        ]}
        empty={{ icon: Receipt, title: period === 'tudo' ? 'Nenhuma despesa registrada' : 'Nenhuma despesa neste período', text: 'Cada despesa precisa de justificativa e comprovante para entrar na prestação de contas.' }}
      />
      <ExpenseForm open={creating} onClose={() => setCreating(false)} onSaved={(m) => { expenses.reload(); docs.reload(); toast(m) }} />
      <EditText row={editing} onClose={() => setEditing(null)} onSaved={() => { expenses.reload(); toast('Despesa atualizada') }} />
      <ReverseModal open={!!reversing} title="Estornar despesa" onClose={() => setReversing(null)}
        summary={reversing && <>{reversing.description}, {money(reversing.amount)} em {dateBR(reversing.date)}.</>}
        onConfirm={async (reason, key) => { await reverseExpense(reversing!, reason, key, now); expenses.reload(); toast('Estorno registrado') }} />
      <AttachModal open={!!attaching} title="Anexar comprovante" category="comprovante" link={{ expenseId: attaching?.id }}
        defaultTitle={attaching ? `Comprovante: ${attaching.description}` : ''} onClose={() => setAttaching(null)} onSaved={() => { docs.reload(); toast('Comprovante anexado') }} />
      <AuditModal table="expenses" id={audit?.id ?? null} title={audit ? `Histórico: ${audit.description}` : ''} labels={AUDIT_LABELS} onClose={() => setAudit(null)} />
    </>
  )
}

function ExpenseForm({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (m: string) => void }) {
  const empty = { description: '', category: 'agencia' as ExpenseCategory, date: today(), amount: '', justification: '' }
  const [f, setF] = useState(empty)
  const [file, setFile] = useState<File | null>(null)
  const [key, setKey] = useState(newKey)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (open) { setF(empty); setFile(null); setKey(newKey()); setError(null) } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const cents = parseMoney(f.amount)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (f.description.trim().length < 2) { setError('Descreva a despesa.'); return }
    if (cents === null) { setError('Valor inválido. Use, por exemplo, 100 ou 75,50.'); return }
    if (f.justification.trim().length < 3) { setError('Explique por que o gasto foi necessário.'); return }
    if (f.date > today()) { setError('A data não pode ser no futuro.'); return }
    if (file && checkFile(file)) { setError(checkFile(file)); return }
    setBusy(true); setError(null)
    try {
      const id = await createExpense({ ...f, amount: cents, idempotencyKey: key })
      if (file) {
        try { await uploadDocument(file, { category: 'comprovante', title: `Comprovante: ${f.description}`, visibility: 'gestao', expenseId: id }) }
        catch (err) { onClose(); onSaved(`Despesa registrada, mas o comprovante não foi enviado (${(err as Error).message}). Use "Anexar" na lista.`); return }
      }
      onClose(); onSaved(file ? 'Despesa e comprovante registrados' : 'Despesa registrada')
    } catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar despesa" description="Confira antes de salvar. Valor e data não podem ser editados, só estornados."
      footer={<>
        {error && <p role="alert" className="mr-auto text-sm text-bad">{error}</p>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" type="submit" form="expense-form" loading={busy}>{cents ? `Salvar ${money(cents)}` : 'Salvar'}</Button>
      </>}>
      <form id="expense-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Descrição">{(id) => <Input id={id} required maxLength={160} value={f.description} onChange={set('description')} placeholder="Ex.: Sinal da agência" />}</Field></div>
        <Field label="Categoria">{(id) => <Select id={id} value={f.category} onChange={set('category')}>{Object.entries(CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>}</Field>
        <Field label="Data">{(id) => <Input id={id} type="date" required max={today()} value={f.date} onChange={set('date')} />}</Field>
        <Field label="Valor">{(id) => <Input id={id} prefix="R$" inputMode="decimal" required value={f.amount} onChange={set('amount')} placeholder="0,00" />}</Field>
        <div className="sm:col-span-2"><Field label="Justificativa">{(id) => <Textarea id={id} required maxLength={1000} value={f.justification} onChange={set('justification')} placeholder="Por que este gasto foi necessário" />}</Field></div>
        <div className="sm:col-span-2"><Field label="Comprovante (opcional agora)" hint="PDF ou foto, até 10 MB. Pode anexar depois.">{() => <FilePicker file={file} onPick={setFile} />}</Field></div>
      </form>
    </Modal>
  )
}

function EditText({ row, onClose, onSaved }: { row: Row | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ description: '', justification: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (row) { setF({ description: row.description, justification: row.justification }); setError(null) } }, [row])
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (f.description.trim().length < 2 || f.justification.trim().length < 3) { setError('Preencha descrição e justificativa.'); return }
    setBusy(true); setError(null)
    try { await updateExpenseText(row!.id, f.description, f.justification); onClose(); onSaved() }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }
  return (
    <Modal open={!!row} onClose={onClose} title="Corrigir descrição" description="Só textos podem ser corrigidos. Para mudar valor, data ou categoria, estorne e registre de novo."
      footer={<>
        {error && <p role="alert" className="mr-auto text-sm text-bad">{error}</p>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" type="submit" form="expense-edit" loading={busy}>Salvar</Button>
      </>}>
      <form id="expense-edit" onSubmit={submit} className="grid gap-4">
        <Field label="Descrição">{(id) => <Input id={id} maxLength={160} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />}</Field>
        <Field label="Justificativa">{(id) => <Textarea id={id} maxLength={1000} value={f.justification} onChange={(e) => setF({ ...f, justification: e.target.value })} />}</Field>
      </form>
    </Modal>
  )
}
