import { Fragment, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Building2, Check, FileText, History, Minus, Paperclip, Pencil, Plus, Scale, Star } from 'lucide-react'
import { PageHeader, StageNotice, Badge, Button, Card, CardHeader, Check as CheckBox, EmptyState, Field, Input, Modal, Segmented, Select, Textarea, useToast, type Column } from '@/components/ui'
import { TableCard } from '@/components/patterns/TableCard'
import { AttachModal } from '@/components/patterns/AttachModal'
import { AuditModal } from '@/components/patterns/AuditModal'
import { useSettings } from '@/app/SettingsContext'
import { useAuth } from '@/data/auth'
import { connected } from '@/data/supabase'
import { listAgencies, saveAgency, saveProposal, type AgencyInput, type AgencyRow, type ProposalRow } from '@/data/agencies'
import { listDocuments, openDocument, type DocumentRow } from '@/data/documents'
import { dateBR, today, useRemote } from '@/data/useRemote'
import { money, moneyShort } from '@/lib/format'
import { parseMoney } from '@/lib/payments'
import { formatCnpj, isValidCnpj } from '@/lib/cnpj'
import { SERVICES, SERVICE_LABEL, bestByCriterion, includedCount, type ServiceKey, type Services } from '@/lib/proposals'
import { accessNotice } from '../stage'

type PRow = ProposalRow & { agency: AgencyRow | undefined; pdfs: DocumentRow[] }
const PROPOSAL_LABELS = {
  preco_aluno: 'Preço por aluno (centavos)', validade: 'Validade', recebida_em: 'Recebida em', condicoes_pagamento: 'Pagamento',
  politica_cancelamento: 'Cancelamento', servicos: 'Serviços', observacoes: 'Observações', status: 'Situação', agency_id: 'Agência',
}
const AGENCY_LABELS = { nome: 'Nome', cnpj: 'CNPJ', cadastur: 'Cadastur', contato_nome: 'Contato', telefone: 'Telefone', email: 'E-mail', site: 'Site', observacoes: 'Observações' }

export function AgenciesPage() {
  const s = useSettings()
  const { canReadAll, isAdmin } = useAuth()
  const toast = useToast()
  const enabled = connected && canReadAll
  const data = useRemote(listAgencies, enabled, { agencies: [], proposals: [] })
  const docs = useRemote(listDocuments, enabled, [])
  const [tab, setTab] = useState('Comparar')
  const [proposalForm, setProposalForm] = useState<{ edit: ProposalRow | null } | null>(null)
  const [agencyForm, setAgencyForm] = useState<{ edit: AgencyRow | null } | null>(null)
  const [attaching, setAttaching] = useState<PRow | null>(null)
  const [audit, setAudit] = useState<{ table: 'proposals' | 'agencies'; id: string; title: string } | null>(null)
  const now = today()

  const byAgency = useMemo(() => new Map(data.data.agencies.map((a) => [a.id, a])), [data.data.agencies])
  const rows: PRow[] = useMemo(() => data.data.proposals.map((p) => ({
    ...p, agency: byAgency.get(p.agencyId), pdfs: docs.data.filter((d) => d.proposalId === p.id && !d.deletedAt),
  })), [data.data.proposals, byAgency, docs.data])
  const reload = () => { data.reload(); docs.reload() }
  const loading = data.loading || docs.loading
  const error = data.error ?? docs.error

  const proposalColumns: Column<PRow>[] = [
    { key: 'agency', header: 'Agência', primary: true, render: (r) => <span className="font-medium">{r.agency?.name ?? '—'}</span> },
    { key: 'price', header: 'Por aluno', align: 'right', render: (r) => money(r.pricePerStudent) },
    { key: 'inc', header: 'Inclui', hideOnMobile: true, render: (r) => <span className="flex gap-1 flex-wrap">{SERVICES.filter((k) => r.services[k]?.incluso).map((k) => <Badge key={k}>{SERVICE_LABEL[k]}</Badge>)}</span> },
    { key: 'valid', header: 'Validade', render: (r) => r.validUntil ? <span className={r.validUntil < now ? 'text-bad' : ''}>{dateBR(r.validUntil)}</span> : '—' },
    { key: 'status', header: 'Situação', render: (r) => (
      <span className="inline-flex flex-wrap items-center gap-1">
        {r.status === 'descartada' ? <Badge>Descartada</Badge> : r.validUntil && r.validUntil < now ? <Badge tone="warn">Vencida</Badge> : <Badge dot tone="ok">Ativa</Badge>}
        {r.pdfs.map((d) => <Button key={d.id} size="sm" variant="ghost" icon={FileText} onClick={() => openDocument(d.path).catch((e: Error) => toast(e.message, 'error'))}>PDF</Button>)}
        {isAdmin && <Button size="sm" variant="ghost" icon={Paperclip} aria-label="Anexar PDF" onClick={() => setAttaching(r)} />}
        {isAdmin && <Button size="sm" variant="ghost" icon={Pencil} aria-label="Editar proposta" onClick={() => setProposalForm({ edit: r })} />}
        <Button size="sm" variant="ghost" icon={History} aria-label="Histórico" onClick={() => setAudit({ table: 'proposals', id: r.id, title: `Histórico da proposta: ${r.agency?.name ?? ''}` })} />
      </span>
    ) },
  ]
  const agencyColumns: Column<AgencyRow>[] = [
    { key: 'name', header: 'Agência', primary: true, render: (a) => <span className="font-medium">{a.name}</span> },
    { key: 'cnpj', header: 'CNPJ', render: (a) => (a.cnpj ? formatCnpj(a.cnpj) : <span className="text-warn">Não informado</span>) },
    { key: 'cad', header: 'Cadastur', hideOnMobile: true, render: (a) => a.cadastur ?? '—' },
    { key: 'contact', header: 'Contato', render: (a) => [a.contactName, a.phone, a.email].filter(Boolean).join(' · ') || '—' },
    { key: 'n', header: 'Propostas', render: (a) => data.data.proposals.filter((p) => p.agencyId === a.id).length },
    { key: 'act', header: '', render: (a) => (
      <span className="inline-flex gap-1">
        {isAdmin && <Button size="sm" variant="ghost" icon={Pencil} aria-label={`Editar ${a.name}`} onClick={() => setAgencyForm({ edit: a })} />}
        <Button size="sm" variant="ghost" icon={History} aria-label="Histórico" onClick={() => setAudit({ table: 'agencies', id: a.id, title: `Histórico: ${a.name}` })} />
      </span>
    ) },
  ]

  return (
    <>
      <PageHeader icon={Building2} section="Organização" title="Agências" description="Propostas recebidas lado a lado, com o que cada uma inclui e em que condições."
        actions={isAdmin ? <>
          <Button icon={Plus} onClick={() => setAgencyForm({ edit: null })}>Nova agência</Button>
          <Button variant="primary" icon={Plus} onClick={() => setProposalForm({ edit: null })} disabled={!data.data.agencies.length} title={data.data.agencies.length ? undefined : 'Cadastre uma agência primeiro'}>Adicionar proposta</Button>
        </> : undefined} />
      {accessNotice(connected, canReadAll) ? <StageNotice>{accessNotice(connected, canReadAll)}</StageNotice>
        : <StageNotice>Peça propostas com o mesmo escopo (datas, número de alunos, serviços) a pelo menos três agências. O sistema destaca o melhor em cada critério, mas não escolhe a vencedora: a decisão é da turma, dos pais e do professor.</StageNotice>}

      <Segmented label="Visualização" options={['Comparar', 'Propostas', 'Agências']} value={tab} onChange={setTab} />
      <div className="mt-4">
        {tab === 'Comparar' && <Compare rows={rows} loading={loading} error={error} students={s.expectedStudents} today={now} />}
        {tab === 'Propostas' && <TableCard columns={proposalColumns} rows={rows} rowKey={(r) => r.id} loading={loading} error={error}
          searchPlaceholder="Buscar agência" filters={['Ativas', 'Descartadas', 'Todas']}
          matches={(r, q, f) => (!q || (r.agency?.name ?? '').toLowerCase().includes(q)) && (f === 'Todas' || (f === 'Ativas' ? r.status === 'ativa' : r.status === 'descartada'))}
          empty={{ icon: Building2, title: 'Nenhuma proposta recebida', text: 'Cadastre a agência e depois a proposta, com preço, validade e o que está incluído.' }} />}
        {tab === 'Agências' && <TableCard columns={agencyColumns} rows={data.data.agencies} rowKey={(a) => a.id} loading={loading} error={error}
          searchPlaceholder="Buscar agência" matches={(a, q) => !q || a.name.toLowerCase().includes(q)}
          empty={{ icon: Building2, title: 'Nenhuma agência cadastrada', text: 'Confira CNPJ e Cadastur ativos antes de contratar.' }} />}
      </div>

      <AgencyForm open={!!agencyForm} edit={agencyForm?.edit ?? null} onClose={() => setAgencyForm(null)} onSaved={(m) => { reload(); toast(m) }} />
      <ProposalForm open={!!proposalForm} edit={proposalForm?.edit ?? null} agencies={data.data.agencies} onClose={() => setProposalForm(null)} onSaved={(m) => { reload(); toast(m) }} />
      <AttachModal open={!!attaching} title="Anexar PDF da proposta" category="proposta" link={{ proposalId: attaching?.id }}
        defaultTitle={attaching ? `Proposta ${attaching.agency?.name ?? ''}` : ''} onClose={() => setAttaching(null)} onSaved={() => { docs.reload(); toast('Arquivo anexado') }} />
      <AuditModal table={audit?.table ?? 'proposals'} id={audit?.id ?? null} title={audit?.title ?? ''}
        labels={audit?.table === 'agencies' ? AGENCY_LABELS : PROPOSAL_LABELS} onClose={() => setAudit(null)} />
    </>
  )
}

// ---------------------------------------------------------------- comparação lado a lado
function Compare({ rows, loading, error, students, today: now }: { rows: PRow[]; loading: boolean; error: string | null; students: number; today: string }) {
  const active = rows.filter((r) => r.status === 'ativa')
  const best = bestByCriterion(active, now)
  if (loading) return <Card><p className="px-5 py-14 text-center text-sm text-muted">Carregando…</p></Card>
  if (error) return <Card><p className="px-5 py-14 text-center text-sm text-bad">{error}</p></Card>
  if (!active.length) return <Card><EmptyState icon={Scale} title="Nada para comparar ainda">Com duas ou mais propostas ativas, elas aparecem aqui lado a lado.</EmptyState></Card>
  const Best = ({ on }: { on: boolean }) => on ? <Star size={13} className="inline -mt-0.5 ml-1 text-gold fill-gold" aria-label="melhor neste critério" /> : null
  const cell = (on: boolean) => `px-4 py-3 align-top ${on ? 'bg-gold/[0.08]' : ''}`
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Comparação" hint={<>Destaque <Star size={12} className="inline -mt-0.5 text-gold fill-gold" aria-hidden /> = melhor naquele critério. Total estimado considera {students} participantes.</>} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm num min-w-[560px]">
          <thead><tr className="border-y border-line">
            <th scope="col" className="text-left text-xs font-medium text-faint px-4 h-10 w-44">Critério</th>
            {active.map((r) => <th key={r.id} scope="col" className="text-left px-4 font-semibold">{r.agency?.name ?? '—'}</th>)}
          </tr></thead>
          <tbody className="[&>tr]:border-b [&>tr]:border-line/70">
            <tr><th scope="row" className="text-left font-normal text-muted px-4 py-3">Preço por aluno</th>
              {active.map((r) => <td key={r.id} className={cell(best.price.has(r.id))}><b>{money(r.pricePerStudent)}</b><Best on={best.price.has(r.id)} /></td>)}</tr>
            <tr><th scope="row" className="text-left font-normal text-muted px-4 py-3">Total estimado</th>
              {active.map((r) => <td key={r.id} className={cell(false)}>{moneyShort(r.pricePerStudent * students)}</td>)}</tr>
            <tr><th scope="row" className="text-left font-normal text-muted px-4 py-3">Validade</th>
              {active.map((r) => <td key={r.id} className={cell(best.validity.has(r.id))}>{r.validUntil ? <>{dateBR(r.validUntil)}{best.expired.has(r.id) && <Badge tone="warn">Vencida</Badge>}<Best on={best.validity.has(r.id)} /></> : '—'}</td>)}</tr>
            <tr><th scope="row" className="text-left font-normal text-muted px-4 py-3">Serviços incluídos</th>
              {active.map((r) => <td key={r.id} className={cell(best.included.has(r.id))}>{includedCount(r.services)} de {SERVICES.length}<Best on={best.included.has(r.id)} /></td>)}</tr>
            {SERVICES.map((k) => (
              <tr key={k}><th scope="row" className="text-left font-normal text-muted px-4 py-3">{SERVICE_LABEL[k]}</th>
                {active.map((r) => { const v = r.services[k]; return (
                  <td key={r.id} className={cell(false)}>
                    {v?.incluso ? <span className="inline-flex items-start gap-1.5 text-ok"><Check size={15} className="mt-0.5 shrink-0" aria-label="incluso" /><span className="text-ink">{v.detalhe || 'Incluso'}</span></span>
                      : <span className="inline-flex items-center gap-1.5 text-faint"><Minus size={15} aria-label="não incluso" />Não incluso</span>}
                  </td>) })}</tr>
            ))}
            {([['paymentTerms', 'Pagamento'], ['cancellation', 'Cancelamento'], ['notes', 'Observações']] as const).map(([k, l]) => (
              <tr key={k}><th scope="row" className="text-left font-normal text-muted px-4 py-3">{l}</th>
                {active.map((r) => <td key={r.id} className={`${cell(false)} whitespace-pre-line font-sans`}>{r[k] || <span className="text-faint">Não informado</span>}</td>)}</tr>
            ))}
            <tr><th scope="row" className="text-left font-normal text-muted px-4 py-3">CNPJ e Cadastur</th>
              {active.map((r) => <td key={r.id} className={cell(false)}>
                {r.agency?.cnpj ? formatCnpj(r.agency.cnpj) : <span className="text-warn">CNPJ não informado</span>}
                <span className="block text-xs text-muted mt-0.5">{r.agency?.cadastur ? `Cadastur ${r.agency.cadastur}` : 'Cadastur não informado'}</span>
              </td>)}</tr>
          </tbody>
        </table>
      </div>
      <p className="px-5 py-4 text-xs text-faint border-t border-line">Preços e condições como informados pelas agências. Confirme tudo por escrito antes de contratar.</p>
    </Card>
  )
}

// ---------------------------------------------------------------- formulários
const emptyAgency: AgencyInput = { name: '', cnpj: '', cadastur: '', contactName: '', phone: '', email: '', site: '', notes: '' }

function AgencyForm({ open, edit, onClose, onSaved }: { open: boolean; edit: AgencyRow | null; onClose: () => void; onSaved: (m: string) => void }) {
  const [f, setF] = useState<AgencyInput>(emptyAgency)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (open) { setF(edit ? { ...edit, cnpj: edit.cnpj ? formatCnpj(edit.cnpj) : '' } : emptyAgency); setError(null) } }, [open, edit])
  const set = (k: keyof AgencyInput) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const cnpjBad = !!f.cnpj?.trim() && !isValidCnpj(f.cnpj)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (f.name.trim().length < 2) { setError('Informe o nome da agência.'); return }
    if (cnpjBad) { setError('CNPJ inválido. Confira os números.'); return }
    if (f.email?.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) { setError('E-mail inválido.'); return }
    setBusy(true); setError(null)
    try { await saveAgency(f, edit?.id); onClose(); onSaved(edit ? 'Agência atualizada' : 'Agência cadastrada') }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title={edit ? 'Editar agência' : 'Nova agência'} description="Mudanças ficam no histórico."
      footer={<>
        {error && <p role="alert" className="mr-auto text-sm text-bad">{error}</p>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" type="submit" form="agency-form" loading={busy}>Salvar</Button>
      </>}>
      <form id="agency-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Nome">{(id) => <Input id={id} required maxLength={120} value={f.name} onChange={set('name')} placeholder="Nome fantasia" />}</Field></div>
        <Field label="CNPJ" error={cnpjBad ? 'CNPJ inválido' : null}>{(id) => <Input id={id} inputMode="numeric" maxLength={18} value={f.cnpj ?? ''} onChange={set('cnpj')} placeholder="00.000.000/0000-00" />}</Field>
        <Field label="Cadastur" hint="Registro no Ministério do Turismo">{(id) => <Input id={id} maxLength={40} value={f.cadastur ?? ''} onChange={set('cadastur')} />}</Field>
        <Field label="Pessoa de contato">{(id) => <Input id={id} maxLength={120} value={f.contactName ?? ''} onChange={set('contactName')} />}</Field>
        <Field label="Telefone">{(id) => <Input id={id} maxLength={40} value={f.phone ?? ''} onChange={set('phone')} />}</Field>
        <Field label="E-mail">{(id) => <Input id={id} type="email" maxLength={120} value={f.email ?? ''} onChange={set('email')} />}</Field>
        <Field label="Site">{(id) => <Input id={id} maxLength={200} value={f.site ?? ''} onChange={set('site')} />}</Field>
        <div className="sm:col-span-2"><Field label="Observações">{(id) => <Textarea id={id} maxLength={1000} value={f.notes ?? ''} onChange={set('notes')} />}</Field></div>
      </form>
    </Modal>
  )
}

type PForm = { agencyId: string; price: string; validUntil: string; receivedAt: string; paymentTerms: string; cancellation: string; notes: string; status: 'ativa' | 'descartada'; services: Services }

function ProposalForm({ open, edit, agencies, onClose, onSaved }: { open: boolean; edit: ProposalRow | null; agencies: AgencyRow[]; onClose: () => void; onSaved: (m: string) => void }) {
  const blank = (): PForm => ({ agencyId: '', price: '', validUntil: '', receivedAt: today(), paymentTerms: '', cancellation: '', notes: '', status: 'ativa', services: {} })
  const [f, setF] = useState<PForm>(blank)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    setF(edit ? {
      agencyId: edit.agencyId, price: (edit.pricePerStudent / 100).toFixed(2).replace('.', ','), validUntil: edit.validUntil ?? '', receivedAt: edit.receivedAt,
      paymentTerms: edit.paymentTerms ?? '', cancellation: edit.cancellation ?? '', notes: edit.notes ?? '', status: edit.status, services: edit.services,
    } : blank())
    setError(null)
  }, [open, edit])
  const set = (k: keyof PForm) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const setService = (k: ServiceKey, patch: { incluso?: boolean; detalhe?: string }) =>
    setF({ ...f, services: { ...f.services, [k]: { incluso: f.services[k]?.incluso ?? false, detalhe: f.services[k]?.detalhe ?? null, ...patch } } })

  async function submit(e: FormEvent) {
    e.preventDefault()
    const cents = parseMoney(f.price)
    if (!f.agencyId) { setError('Escolha a agência.'); return }
    if (cents === null) { setError('Preço por aluno inválido.'); return }
    // grava só serviços marcados ou com detalhe
    const services = Object.fromEntries(SERVICES.filter((k) => f.services[k]?.incluso || f.services[k]?.detalhe?.trim())
      .map((k) => [k, { incluso: !!f.services[k]?.incluso, detalhe: f.services[k]?.detalhe?.trim() || null }]))
    setBusy(true); setError(null)
    try {
      await saveProposal({ agencyId: f.agencyId, pricePerStudent: cents, validUntil: f.validUntil || null, receivedAt: f.receivedAt,
        paymentTerms: f.paymentTerms, cancellation: f.cancellation, services, notes: f.notes, status: f.status }, edit?.id)
      onClose(); onSaved(edit ? 'Proposta atualizada' : 'Proposta cadastrada')
    } catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <Modal wide open={open} onClose={onClose} title={edit ? 'Editar proposta' : 'Adicionar proposta'} description="Registre exatamente o que a agência ofereceu. Mudanças ficam no histórico."
      footer={<>
        {error && <p role="alert" className="mr-auto text-sm text-bad">{error}</p>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" type="submit" form="proposal-form" loading={busy}>Salvar</Button>
      </>}>
      <form id="proposal-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-4">
        <div className="sm:col-span-2"><Field label="Agência">{(id) => <Select id={id} required value={f.agencyId} onChange={set('agencyId')}>
          <option value="" disabled>Selecione</option>{agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>}</Field></div>
        <div className="sm:col-span-2"><Field label="Preço por aluno">{(id) => <Input id={id} prefix="R$" inputMode="decimal" required value={f.price} onChange={set('price')} placeholder="0,00" />}</Field></div>
        <div className="sm:col-span-2"><Field label="Recebida em">{(id) => <Input id={id} type="date" required value={f.receivedAt} onChange={set('receivedAt')} />}</Field></div>
        <div className="sm:col-span-2"><Field label="Válida até">{(id) => <Input id={id} type="date" value={f.validUntil} onChange={set('validUntil')} />}</Field></div>
        <fieldset className="sm:col-span-4">
          <legend className="text-[13px] font-medium mb-2">O que está incluído</legend>
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            {SERVICES.map((k) => (
              <Fragment key={k}>
                <div className="flex items-center gap-3">
                  <div className="w-36 shrink-0"><CheckBox label={SERVICE_LABEL[k]} checked={!!f.services[k]?.incluso} onChange={(e) => setService(k, { incluso: e.target.checked })} /></div>
                  <Input aria-label={`Detalhe de ${SERVICE_LABEL[k]}`} maxLength={300} value={f.services[k]?.detalhe ?? ''} onChange={(e) => setService(k, { detalhe: e.target.value })}
                    placeholder={{ transporte: 'Ex.: ônibus executivo', hospedagem: 'Ex.: hotel 3★, quarto quádruplo', ingressos: 'Ex.: 2 dias de parque', alimentacao: 'Ex.: café e jantar', seguro: 'Ex.: cobertura médica', monitoramento: 'Ex.: 1 monitor a cada 10 alunos' }[k]} />
                </div>
              </Fragment>
            ))}
          </div>
        </fieldset>
        <div className="sm:col-span-2"><Field label="Condições de pagamento">{(id) => <Textarea id={id} maxLength={1000} value={f.paymentTerms} onChange={set('paymentTerms')} placeholder="Sinal, parcelas, prazos" />}</Field></div>
        <div className="sm:col-span-2"><Field label="Política de cancelamento">{(id) => <Textarea id={id} maxLength={1000} value={f.cancellation} onChange={set('cancellation')} placeholder="Multas e prazos de desistência" />}</Field></div>
        <div className="sm:col-span-3"><Field label="Observações">{(id) => <Textarea id={id} maxLength={1000} value={f.notes} onChange={set('notes')} />}</Field></div>
        {edit && <Field label="Situação">{(id) => <Select id={id} value={f.status} onChange={set('status')}><option value="ativa">Ativa</option><option value="descartada">Descartada</option></Select>}</Field>}
      </form>
    </Modal>
  )
}
