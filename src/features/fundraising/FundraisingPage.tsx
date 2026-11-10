import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { FileCheck2, History, HandCoins, Minus, Paperclip, PartyPopper, Pencil, Plus, TrendingUp, Undo2 } from 'lucide-react'
import { ListPage } from '@/components/patterns/ListPage'
import { PeriodFilter } from '@/components/patterns/PeriodFilter'
import { ReverseModal } from '@/components/patterns/ReverseModal'
import { AuditModal } from '@/components/patterns/AuditModal'
import { AttachModal } from '@/components/patterns/AttachModal'
import { listDocuments, openDocument, type DocumentRow } from '@/data/documents'
import { Badge, Button, Field, Input, Modal, Select, Textarea, useToast } from '@/components/ui'
import { useAuth } from '@/data/auth'
import { connected } from '@/data/supabase'
import {
  KIND_LABEL, addFundraisingEntry, createFundraising, fundraisingTotals, listFundraisings, reverseFundraisingEntry, updateFundraising,
  type FundraisingEntry, type FundraisingKind, type FundraisingRow,
} from '@/data/cash'
import { dateBR, newKey, today, useRemote } from '@/data/useRemote'
import { money } from '@/lib/format'
import { parseMoney } from '@/lib/payments'
import { inRange, presetRange, type PeriodPreset } from '@/lib/period'
import { accessNotice } from '../stage'

type Row = FundraisingRow & { gross: number; costs: number; net: number }
const AUDIT_LABELS = { titulo: 'Nome', tipo: 'Tipo', data: 'Data', responsavel: 'Responsável', observacoes: 'Observações' }

/** Ações coletivas: receita bruta e custos em lançamentos imutáveis; nome, data e responsável podem ser corrigidos. */
export function FundraisingPage() {
  const { canReadAll, isAdmin } = useAuth()
  const toast = useToast()
  const enabled = connected && canReadAll
  const list = useRemote(listFundraisings, enabled, [])
  const docs = useRemote(listDocuments, enabled, [])
  const [period, setPeriod] = useState<PeriodPreset>('tudo')
  const [form, setForm] = useState<{ edit: FundraisingRow | null } | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [audit, setAudit] = useState<FundraisingRow | null>(null)

  const range = presetRange(period, today())
  const all: Row[] = useMemo(() => list.data.map((f) => ({ ...f, ...fundraisingTotals(f.entries) })), [list.data])
  const rows = all.filter((r) => inRange(r.date, range))
  const sum = (k: 'gross' | 'costs' | 'net') => rows.reduce((s, r) => s + r[k], 0)
  const opened = all.find((r) => r.id === detail) ?? null

  return (
    <>
      <ListPage<Row>
        icon={HandCoins} section="Financeiro" title="Arrecadações"
        description="Ações coletivas com receita bruta, custos e o lucro que de fato entrou no caixa."
        createLabel="Registrar ação" onCreate={() => setForm({ edit: null })} canCreate={isAdmin}
        locked={connected && !canReadAll}
        notice={accessNotice(connected, canReadAll) ?? (isAdmin ? 'Antes de organizar rifas, confirme com a escola se a modalidade é permitida. Vendas e eventos são alternativas seguras.' : null)}
        loading={list.loading} error={list.error}
        metrics={[
          { icon: TrendingUp, label: 'Receita bruta', value: money(sum('gross')) },
          { icon: Minus, label: 'Custos', value: money(sum('costs')) },
          { icon: HandCoins, label: 'Lucro líquido', value: money(sum('net')), tone: 'ok', info: 'Receita bruta − custos das ações do período. Estornos já descontados.' },
          { icon: PartyPopper, label: 'Ações', value: rows.length },
        ]}
        extra={<PeriodFilter value={period} onChange={setPeriod} />}
        searchPlaceholder="Buscar ação ou responsável" filters={['Todas', ...Object.values(KIND_LABEL)]}
        rows={rows} rowKey={(r) => r.id}
        matches={(r, q, f) => (!q || `${r.title} ${r.responsible ?? ''}`.toLowerCase().includes(q)) && (f === 'Todas' || KIND_LABEL[r.kind] === f)}
        columns={[
          { key: 'title', header: 'Ação', primary: true, render: (r) => <button className="font-medium text-left hover:text-accent" onClick={() => setDetail(r.id)}>{r.title}</button> },
          { key: 'kind', header: 'Tipo', render: (r) => <Badge>{KIND_LABEL[r.kind]}</Badge> },
          { key: 'date', header: 'Data', hideOnMobile: true, render: (r) => dateBR(r.date) },
          { key: 'gross', header: 'Bruto', align: 'right', hideOnMobile: true, render: (r) => money(r.gross) },
          { key: 'costs', header: 'Custos', align: 'right', hideOnMobile: true, render: (r) => money(r.costs) },
          { key: 'net', header: 'Líquido', align: 'right', render: (r) => <b className={r.net < 0 ? 'text-bad' : ''}>{money(r.net)}</b> },
          { key: 'act', header: 'Ações', render: (r) => (
            <span className="inline-flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setDetail(r.id)}>Lançamentos</Button>
              {isAdmin && <Button size="sm" variant="ghost" icon={Pencil} aria-label={`Editar ${r.title}`} onClick={() => setForm({ edit: r })} />}
              <Button size="sm" variant="ghost" icon={History} aria-label={`Histórico de ${r.title}`} onClick={() => setAudit(r)} />
            </span>
          ) },
        ]}
        empty={{ icon: HandCoins, title: period === 'tudo' ? 'Nenhuma ação registrada' : 'Nenhuma ação neste período', text: 'Registre vendas, eventos, doações e patrocínios com os custos para ver o lucro real de cada uma.' }}
      />
      <FundraisingForm open={!!form} edit={form?.edit ?? null} onClose={() => setForm(null)} onSaved={(m) => { list.reload(); toast(m) }} />
      <EntriesModal row={opened} isAdmin={isAdmin} onClose={() => setDetail(null)} onChanged={(m) => { list.reload(); docs.reload(); toast(m) }}
        receipts={opened ? docs.data.filter((d) => d.fundraisingId === opened.id && !d.deletedAt) : []} />
      <AuditModal table="fundraisings" id={audit?.id ?? null} title={audit ? `Histórico: ${audit.title}` : ''} labels={AUDIT_LABELS} onClose={() => setAudit(null)} />
    </>
  )
}

function FundraisingForm({ open, edit, onClose, onSaved }: { open: boolean; edit: FundraisingRow | null; onClose: () => void; onSaved: (m: string) => void }) {
  const empty = { title: '', kind: 'venda' as FundraisingKind, date: today(), responsible: '', notes: '', gross: '', costs: '' }
  const [f, setF] = useState(empty)
  const [key, setKey] = useState(newKey)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    setF(edit ? { title: edit.title, kind: edit.kind, date: edit.date, responsible: edit.responsible ?? '', notes: edit.notes ?? '', gross: '', costs: '' } : empty)
    setKey(newKey()); setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, edit])
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const gross = f.gross.trim() ? parseMoney(f.gross) : 0
  const costs = f.costs.trim() ? parseMoney(f.costs) : 0

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (f.title.trim().length < 2) { setError('Dê um nome à ação.'); return }
    if (f.date > today()) { setError('A data não pode ser no futuro.'); return }
    setBusy(true); setError(null)
    try {
      if (edit) { await updateFundraising(edit.id, f); onSaved('Ação atualizada') }
      else {
        if (gross === null || costs === null) { setError('Valor inválido. Use, por exemplo, 100 ou 75,50.'); setBusy(false); return }
        await createFundraising({ ...f, gross, costs, idempotencyKey: key }); onSaved('Ação registrada')
      }
      onClose()
    } catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={edit ? 'Editar ação' : 'Registrar ação'}
      description={edit ? 'Corrige dados descritivos. Valores são corrigidos por estorno, em Lançamentos.' : 'Receita e custos viram lançamentos que não podem ser editados, só estornados.'}
      footer={<>
        {error && <p role="alert" className="mr-auto text-sm text-bad">{error}</p>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" type="submit" form="fund-form" loading={busy}>Salvar</Button>
      </>}>
      <form id="fund-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Nome da ação">{(id) => <Input id={id} required maxLength={120} value={f.title} onChange={set('title')} placeholder="Ex.: Bazar de junho" />}</Field></div>
        <Field label="Tipo">{(id) => <Select id={id} value={f.kind} onChange={set('kind')}>{Object.entries(KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>}</Field>
        <Field label="Data">{(id) => <Input id={id} type="date" required max={today()} value={f.date} onChange={set('date')} />}</Field>
        <div className="sm:col-span-2"><Field label="Responsável" hint="Opcional">{(id) => <Input id={id} maxLength={120} value={f.responsible} onChange={set('responsible')} />}</Field></div>
        {!edit && <>
          <Field label="Receita bruta" hint="Tudo que entrou">{(id) => <Input id={id} prefix="R$" inputMode="decimal" value={f.gross} onChange={set('gross')} placeholder="0,00" />}</Field>
          <Field label="Custos" hint="Materiais, taxas, compras para revenda">{(id) => <Input id={id} prefix="R$" inputMode="decimal" value={f.costs} onChange={set('costs')} placeholder="0,00" />}</Field>
          {gross !== null && costs !== null && (gross > 0 || costs > 0) && <p className="sm:col-span-2 text-sm num">Lucro líquido: <b className={gross - costs < 0 ? 'text-bad' : 'text-ok'}>{money(gross - costs)}</b></p>}
        </>}
        <div className="sm:col-span-2"><Field label="Observações" hint="Opcional">{(id) => <Textarea id={id} maxLength={1000} value={f.notes} onChange={set('notes')} placeholder="Onde, como foi, quem ajudou" />}</Field></div>
      </form>
    </Modal>
  )
}

function EntriesModal({ row, isAdmin, receipts, onClose, onChanged }: {
  row: Row | null; isAdmin: boolean; receipts: DocumentRow[]; onClose: () => void; onChanged: (m: string) => void
}) {
  const toast = useToast()
  const [attaching, setAttaching] = useState(false)
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ type: 'receita' as 'receita' | 'custo', amount: '', date: today(), description: '' })
  const [key, setKey] = useState(newKey)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reversing, setReversing] = useState<FundraisingEntry | null>(null)
  useEffect(() => { setAdding(false); setError(null) }, [row?.id])
  if (!row) return null
  const reversed = new Set(row.entries.flatMap((e) => (e.reversalOf ? [e.reversalOf] : [])))

  async function add(e: FormEvent) {
    e.preventDefault()
    const cents = parseMoney(f.amount)
    if (cents === null) { setError('Valor inválido.'); return }
    setBusy(true); setError(null)
    try {
      await addFundraisingEntry({ fundraisingId: row!.id, type: f.type, amount: cents, date: f.date, description: f.description, idempotencyKey: key })
      setAdding(false); setKey(newKey()); setF({ ...f, amount: '', description: '' }); onChanged('Lançamento registrado')
    } catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <Modal wide open onClose={onClose} title={row.title}
      description={<>{KIND_LABEL[row.kind]} · {dateBR(row.date)}{row.responsible && ` · ${row.responsible}`} · líquido <b className="text-ink num">{money(row.net)}</b></>}>
      {row.notes && <p className="text-sm text-muted mb-4 whitespace-pre-line">{row.notes}</p>}
      {row.entries.length ? <ul className="divide-y divide-line/70 text-sm mb-4">
        {row.entries.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 num">
            <span className="flex items-center gap-2">
              <Badge tone={e.type === 'receita' ? 'ok' : 'warn'}>{e.type === 'receita' ? 'Receita' : 'Custo'}</Badge>
              {dateBR(e.date)}{e.description && <span className="text-muted">· {e.description}</span>}
            </span>
            <span className="flex items-center gap-2">
              <span className={e.amount < 0 ? 'text-bad' : ''}>{money(e.amount)}</span>
              {e.reversalOf ? <Badge tone="bad">Estorno</Badge> : reversed.has(e.id) ? <Badge>Estornado</Badge>
                : isAdmin && <Button size="sm" variant="ghost" icon={Undo2} onClick={() => setReversing(e)}>Estornar</Button>}
            </span>
          </li>))}
      </ul> : <p className="text-sm text-muted mb-4">Nenhum lançamento ainda.</p>}

      {isAdmin && (adding ? (
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-4 items-end rounded-md bg-raised ring-1 ring-line p-4">
          <Field label="Tipo">{(id) => <Select id={id} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as 'receita' | 'custo' })}><option value="receita">Receita</option><option value="custo">Custo</option></Select>}</Field>
          <Field label="Valor">{(id) => <Input id={id} prefix="R$" inputMode="decimal" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />}</Field>
          <Field label="Data">{(id) => <Input id={id} type="date" max={today()} required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />}</Field>
          <Field label="Descrição">{(id) => <Input id={id} maxLength={300} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />}</Field>
          <div className="sm:col-span-4 flex items-center justify-end gap-2">
            {error && <p role="alert" className="mr-auto text-sm text-bad">{error}</p>}
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button variant="primary" type="submit" loading={busy}>Adicionar</Button>
          </div>
        </form>
      ) : <Button icon={Plus} onClick={() => { setAdding(true); setKey(newKey()) }}>Novo lançamento</Button>)}

      <div className="mt-6 pt-5 border-t border-line">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h3 className="text-[13px] font-semibold">Comprovantes</h3>
          {isAdmin && <Button size="sm" icon={Paperclip} onClick={() => setAttaching(true)}>Anexar</Button>}
        </div>
        {receipts.length ? <ul className="space-y-1.5">{receipts.map((d) => (
          <li key={d.id}><button className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
            onClick={() => openDocument(d.path).catch((e: Error) => toast(e.message, 'error'))}><FileCheck2 size={15} aria-hidden />{d.title}</button></li>))}</ul>
          : <p className="text-sm text-muted">Nenhum comprovante anexado (notas de compra, recibos, prints de transferência).</p>}
      </div>
      <AttachModal open={attaching} title="Anexar comprovante da ação" category="comprovante" link={{ fundraisingId: row.id }}
        defaultTitle={`Comprovante: ${row.title}`} onClose={() => setAttaching(false)} onSaved={() => onChanged('Comprovante anexado')} />
      <ReverseModal open={!!reversing} onClose={() => setReversing(null)}
        summary={reversing && <>{reversing.type === 'receita' ? 'Receita' : 'Custo'} de {money(reversing.amount)} em {dateBR(reversing.date)}.</>}
        onConfirm={async (reason, k) => { await reverseFundraisingEntry(reversing!, reason, k, today()); onChanged('Estorno registrado') }} />
    </Modal>
  )
}
