import { useMemo, useState, type FormEvent } from 'react'
import { Check as CheckIcon, Download, History, Lock, Pencil, Plane, Settings, ShieldCheck, Sprout, Wallet, X } from 'lucide-react'
import { useSettingsState } from '@/app/SettingsContext'
import { useAuth } from '@/data/auth'
import { connected } from '@/data/supabase'
import { cancelProposal, decideProposal, listProfileNames, listProposals, listVersions, proposeSettings, type SettingsProposal } from '@/data/settings'
import { downloadFile, exportBackup } from '@/data/backup'
import { dateBR, today, useRemote } from '@/data/useRemote'
import { money, percent } from '@/lib/format'
import { parseMoney } from '@/lib/payments'
import {
  FINANCIAL_KEYS, LABELS, diffSettings, formatSettingValue, lastMonth, monthLabel, parsePercent, percentInput, toDb, validateSettings, type DbKey,
} from '@/lib/settings'
import type { ProjectSettings } from '@/types/domain'
import { Badge, Button, Card, CardHeader, Check, EmptyState, Field, Input, Modal, PageHeader, StageNotice, Textarea, Tooltip, useToast } from '@/components/ui'

const centsInput = (c: number) => (c / 100).toFixed(2).replace('.', ',')
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export function SettingsPage() {
  const st = useSettingsState()
  const s = st.settings
  const { isAdmin, canReadAll, role } = useAuth()
  const toast = useToast()
  const enabled = connected && canReadAll
  const versions = useRemote(listVersions, enabled, [])
  const proposals = useRemote(listProposals, enabled, [])
  const names = useRemote(listProfileNames, enabled, new Map<string, string>())
  const [editing, setEditing] = useState(false)
  const pending = proposals.data.find((p) => p.status === 'pendente') ?? null
  const who = (id: string | null) => (id ? names.data.get(id) ?? 'Usuário' : 'Sistema')
  const refresh = () => { st.reload(); versions.reload(); proposals.reload() }

  const lock = (k: DbKey) => FINANCIAL_KEYS.includes(k)
  const groups: { icon: typeof Plane; title: string; hint: string; rows: [DbKey | null, string, string][] }[] = [
    { icon: Plane, title: 'Viagem', hint: 'Destino e grupo', rows: [
      ['destino', 'Destino', `${s.destination}, ${s.destinationCity}`], ['origem', 'Saída', s.origin], ['ano', 'Ano', String(s.tripYear)],
      ['data_ida', 'Datas', s.tripStart ? `${dateBR(s.tripStart)}${s.tripEnd ? ` a ${dateBR(s.tripEnd)}` : ''}` : 'A definir'],
      ['dias', 'Duração', `${s.days} dias e ${s.nights} noites`], ['alunos_previstos', 'Participantes previstos', String(s.expectedStudents)],
      ['orcamento_por_aluno', 'Orçamento por aluno (estimado)', money(s.budgetPerStudent)],
    ] },
    { icon: Wallet, title: 'Mensalidades', hint: 'Valores e prazos', rows: [
      ['mensalidade', 'Valor da mensalidade', money(s.monthlyFee)], ['parcelas', 'Número de parcelas', String(s.months)],
      ['mes_inicio', 'Cobranças', s.startMonth ? `${monthLabel(s.startMonth)} a ${monthLabel(lastMonth(s.startMonth, s.months))}` : 'Início a definir'],
      ['dia_vencimento', 'Vencimento', `Todo dia ${s.dueDay}`], ['adicional_atraso_bp', 'Adicional por atraso', `${percent(s.latePenalty)} sobre o que faltar, uma vez`],
    ] },
    { icon: ShieldCheck, title: 'Participação', hint: 'Adesão e desistência', rows: [
      [null, 'Adesão', 'Voluntária'], ['devolucao_desistencia_bp', 'Devolução na desistência', `${percent(s.refundOnWithdrawal)} do que foi pago`],
      [null, 'Retenção na desistência', percent(1 - s.refundOnWithdrawal)],
      ['novos_pagam_anteriores', 'Quem entra depois', s.newJoinersPayPast ? 'Paga as parcelas que já venceram' : 'Paga a partir do mês de adesão'],
    ] },
    { icon: Sprout, title: 'Rendimento e governança', hint: 'Premissas e responsáveis', rows: [
      ['rendimento_anual_bp', 'Rendimento anual hipotético', percent(s.annualRate)], [null, 'Capitalização', 'Mensal equivalente'],
      ['administrador', 'Administração', s.admin], ['supervisor', 'Supervisão', s.supervisor],
    ] },
  ]

  const notice = !connected
    ? 'Modo demonstração: estes são os valores ilustrativos do briefing. Com o banco conectado, as mudanças ficam gravadas com histórico.'
    : st.error ? `Não foi possível carregar a configuração do banco: ${st.error} Os valores abaixo são o cenário ilustrativo.`
    : null

  return (
    <>
      <PageHeader icon={Settings} section="Administração" title="Configurações" description="Parâmetros que alimentam os cálculos, as parcelas e as regras do projeto."
        actions={<>
          {s.provisional ? <Badge tone="gold">Regras provisórias</Badge> : <Badge tone="ok" dot>Regras aprovadas pelo professor</Badge>}
          {isAdmin && st.source === 'banco' && <Button variant="primary" icon={Pencil} onClick={() => setEditing(true)}>Editar</Button>}
        </>} />
      {notice && <StageNotice>{notice}</StageNotice>}
      {connected && !st.error && (
        <p className="flex items-start gap-2 text-[13px] text-muted -mt-2 mb-6">
          <Lock size={14} className="mt-0.5 shrink-0 text-faint" aria-hidden />
          Campos com cadeado são regras financeiras: mudam só depois da aprovação do professor supervisor. Os demais mudam na hora. Tudo fica no histórico.
        </p>
      )}

      {pending && <PendingCard p={pending} role={role} who={who} onDone={() => { refresh(); }} />}

      <div className="grid gap-6 md:grid-cols-2">
        {groups.map((g) => (
          <Card key={g.title}>
            <CardHeader title={<span className="flex items-center gap-2"><g.icon size={16} className="text-accent" aria-hidden />{g.title}</span>} hint={g.hint} />
            <dl className="px-5 pb-5 text-sm divide-y divide-line/70">
              {g.rows.map(([key, k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <dt className="text-muted flex items-center gap-1.5">{k}{key && lock(key) && <Lock size={12} className="text-faint" aria-label="exige aprovação" />}</dt>
                  <dd className="num font-medium text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ))}
      </div>

      {enabled && <HistoryCard versions={versions} proposals={proposals.data} who={who} />}
      {enabled && <BackupCard onError={(m) => toast(m, 'error')} onDone={() => toast('Cópia de segurança baixada')} />}

      {isAdmin && <SettingsForm open={editing} current={s} pendingExists={!!pending} onClose={() => setEditing(false)}
        onSaved={(r) => {
          setEditing(false); refresh()
          toast(r.proposal && r.version ? 'Mudanças gerais salvas. Regras financeiras enviadas ao professor.'
            : r.proposal ? 'Enviado para aprovação do professor' : 'Configurações atualizadas')
        }} />}
    </>
  )
}

// ---------------------------------------------------------------- proposta pendente
function PendingCard({ p, role, who, onDone }: { p: SettingsProposal; role: string | null; who: (id: string | null) => string; onDone: () => void }) {
  const toast = useToast()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  async function act(kind: 'aprovar' | 'rejeitar' | 'cancelar') {
    if (kind !== 'aprovar' && !confirm(kind === 'cancelar' ? 'Cancelar esta proposta?' : 'Rejeitar esta proposta? Nada muda nas regras.')) return
    setBusy(kind)
    try {
      if (kind === 'cancelar') await cancelProposal(p.id)
      else await decideProposal(p.id, kind === 'aprovar', note)
      toast(kind === 'aprovar' ? 'Regras aprovadas e em vigor' : kind === 'rejeitar' ? 'Proposta rejeitada' : 'Proposta cancelada')
      onDone()
    } catch (e) { toast((e as Error).message, 'error') }
    finally { setBusy(null) }
  }
  return (
    <Card className="mb-6 ring-gold/40">
      <CardHeader title="Mudança de regra aguardando o professor" action={<Badge tone="gold">Pendente</Badge>}
        hint={`Proposta por ${who(p.proposedBy)} em ${fmtDateTime(p.proposedAt)}. Motivo: ${p.reason}`} />
      <ChangesTable changes={p.changes} />
      <div className="px-5 pb-5 pt-4 flex flex-col sm:flex-row sm:items-end gap-3">
        {role === 'supervisor' && <>
          <div className="flex-1"><Field label="Observação (opcional)">{(id) => <Input id={id} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: aprovado em reunião com os pais" />}</Field></div>
          <Button icon={X} loading={busy === 'rejeitar'} onClick={() => void act('rejeitar')}>Rejeitar</Button>
          <Button variant="primary" icon={CheckIcon} loading={busy === 'aprovar'} onClick={() => void act('aprovar')}>Aprovar</Button>
        </>}
        {role === 'admin' && <>
          <p className="flex-1 text-[13px] text-muted">O professor precisa entrar no sistema e aprovar. Enquanto isso, as regras atuais continuam valendo.</p>
          <Button variant="ghost" loading={busy === 'cancelar'} onClick={() => void act('cancelar')}>Cancelar proposta</Button>
        </>}
      </div>
    </Card>
  )
}

function ChangesTable({ changes }: { changes: Record<string, { de: unknown; para: unknown }> }) {
  return (
    <div className="mx-5 rounded-md ring-1 ring-line overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="bg-raised text-xs text-faint"><th className="text-left font-medium px-3 h-9">Campo</th><th className="text-left font-medium px-3">Antes</th><th className="text-left font-medium px-3">Depois</th></tr></thead>
        <tbody>
          {Object.entries(changes).map(([k, v]) => (
            <tr key={k} className="border-t border-line/70">
              <td className="px-3 py-2 text-muted">{LABELS[k as DbKey] ?? k}</td>
              <td className="px-3 py-2 num line-through decoration-faint/60 text-muted">{formatSettingValue(k as DbKey, v.de)}</td>
              <td className="px-3 py-2 num font-medium">{formatSettingValue(k as DbKey, v.para)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------- histórico
function HistoryCard({ versions, proposals, who }: {
  versions: ReturnType<typeof useRemote<Awaited<ReturnType<typeof listVersions>>>>; proposals: SettingsProposal[]; who: (id: string | null) => string
}) {
  const closed = proposals.filter((p) => p.status === 'rejeitada' || p.status === 'cancelada')
  const items = [
    ...versions.data.map((v) => ({ at: v.changedAt, key: `v${v.id}`, v, p: null as SettingsProposal | null })),
    ...closed.map((p) => ({ at: p.decidedAt ?? p.proposedAt, key: `p${p.id}`, v: null, p })),
  ].sort((a, b) => b.at.localeCompare(a.at))
  return (
    <Card className="mt-6">
      <CardHeader title={<span className="flex items-center gap-2"><History size={16} className="text-accent" aria-hidden />Histórico de alterações</span>}
        hint="Cada mudança com autor, data, motivo e valores anteriores. Nada é apagado." />
      {versions.loading ? <p className="px-5 pb-6 text-sm text-muted">Carregando…</p>
        : versions.error ? <p className="px-5 pb-6 text-sm text-bad">{versions.error}</p>
        : !items.length ? <EmptyState icon={History} title="Sem histórico">As alterações aparecem aqui.</EmptyState>
        : <ol className="px-5 pb-5 space-y-5">
          {items.map(({ key, v, p }) => (
            <li key={key} className="relative pl-5 border-l border-line">
              <span className={`absolute -left-[5px] top-1.5 size-2.5 rounded-full ${p ? 'bg-faint' : v?.approvedBy ? 'bg-ok' : 'bg-accent'}`} aria-hidden />
              {v && <>
                <p className="text-sm font-medium">{Object.keys(v.changes).length ? (v.approvedBy ? 'Regra aprovada e em vigor' : 'Alteração aplicada') : 'Configuração inicial'}
                  <span className="font-normal text-faint"> · versão {v.id}</span></p>
                <p className="text-[13px] text-muted mt-0.5">
                  {fmtDateTime(v.changedAt)} · {v.changedBy ? `por ${who(v.changedBy)}` : 'carga inicial'}
                  {v.approvedBy && <> · aprovada por {who(v.approvedBy)}</>}
                </p>
                {v.reason && <p className="text-[13px] text-muted mt-1">Motivo: {v.reason}</p>}
                {Object.keys(v.changes).length > 0 && <ul className="mt-2 space-y-1 text-[13px]">
                  {Object.entries(v.changes).map(([k, c]) => (
                    <li key={k} className="num"><span className="text-muted">{LABELS[k as DbKey] ?? k}:</span> {formatSettingValue(k as DbKey, c.de)} → <b className="font-medium">{formatSettingValue(k as DbKey, c.para)}</b></li>
                  ))}
                </ul>}
              </>}
              {p && <>
                <p className="text-sm font-medium">Proposta {p.status === 'rejeitada' ? 'rejeitada' : 'cancelada'}</p>
                <p className="text-[13px] text-muted mt-0.5">{fmtDateTime(p.decidedAt ?? p.proposedAt)} · proposta por {who(p.proposedBy)}{p.decidedBy && <> · {p.status} por {who(p.decidedBy)}</>}</p>
                <p className="text-[13px] text-muted mt-1">Motivo: {p.reason}{p.decisionNote && <> · Observação: {p.decisionNote}</>}</p>
                <ul className="mt-2 space-y-1 text-[13px] text-muted">
                  {Object.entries(p.changes).map(([k, c]) => <li key={k} className="num">{LABELS[k as DbKey] ?? k}: {formatSettingValue(k as DbKey, c.de)} → {formatSettingValue(k as DbKey, c.para)}</li>)}
                </ul>
              </>}
            </li>
          ))}
        </ol>}
    </Card>
  )
}

// ---------------------------------------------------------------- backup
function BackupCard({ onError, onDone }: { onError: (m: string) => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  async function run() {
    setBusy(true)
    try {
      const b = await exportBackup()
      downloadFile(`monte-trip-backup-${today()}.json`, JSON.stringify(b, null, 1))
      onDone()
    } catch (e) { onError((e as Error).message) }
    finally { setBusy(false) }
  }
  return (
    <Card className="mt-6">
      <CardHeader title={<span className="flex items-center gap-2"><Download size={16} className="text-accent" aria-hidden />Cópia de segurança</span>}
        hint="Baixa todos os dados do projeto (alunos, parcelas, pagamentos, caixa, agências, documentos e histórico) num arquivo JSON." />
      <div className="px-5 pb-5 space-y-3">
        <p className="text-[13px] text-muted leading-relaxed">
          Guarde o arquivo num lugar seguro e privado: ele tem dados pessoais de menores. Faça uma cópia por mês e antes de qualquer mudança grande.
          Os arquivos anexados (PDF e fotos) não entram; baixe-os pela página Documentos. Como restaurar: <code className="text-[12px]">docs/BACKUP.md</code> no repositório.
        </p>
        <Button icon={Download} loading={busy} onClick={() => void run()}>Baixar cópia de segurança</Button>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------- formulário
type FormState = Record<
  'destination' | 'destinationCity' | 'origin' | 'tripYear' | 'tripStart' | 'tripEnd' | 'days' | 'nights' | 'expectedStudents'
  | 'budgetPerStudent' | 'monthlyFee' | 'months' | 'startMonth' | 'dueDay' | 'latePenalty' | 'refundOnWithdrawal' | 'annualRate' | 'admin' | 'supervisor', string
> & { newJoinersPayPast: boolean; provisional: boolean }

const toForm = (s: ProjectSettings): FormState => ({
  destination: s.destination, destinationCity: s.destinationCity, origin: s.origin, tripYear: String(s.tripYear),
  tripStart: s.tripStart ?? '', tripEnd: s.tripEnd ?? '', days: String(s.days), nights: String(s.nights), expectedStudents: String(s.expectedStudents),
  budgetPerStudent: centsInput(s.budgetPerStudent), monthlyFee: centsInput(s.monthlyFee), months: String(s.months), startMonth: s.startMonth ?? '',
  dueDay: String(s.dueDay), latePenalty: percentInput(s.latePenalty), refundOnWithdrawal: percentInput(s.refundOnWithdrawal),
  annualRate: percentInput(s.annualRate), admin: s.admin, supervisor: s.supervisor, newJoinersPayPast: s.newJoinersPayPast, provisional: s.provisional,
})

const intOrNaN = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v) : NaN)

function fromForm(f: FormState): { s: ProjectSettings; errors: Partial<Record<keyof ProjectSettings, string>> } {
  const errors: Partial<Record<keyof ProjectSettings, string>> = {}
  const money = (k: 'budgetPerStudent' | 'monthlyFee') => {
    if (k === 'budgetPerStudent' && f[k].trim().replace(/[R$\s]/g, '') === '0') return 0
    const c = parseMoney(f[k]); if (c === null) errors[k] = 'Valor inválido. Ex.: 100 ou 75,50'; return c ?? 0
  }
  const pct = (k: 'latePenalty' | 'refundOnWithdrawal' | 'annualRate') => {
    const p = parsePercent(f[k]); if (p === null) errors[k] = 'Percentual inválido. Ex.: 15 ou 12,5'; return p ?? 0
  }
  const s: ProjectSettings = {
    destination: f.destination, destinationCity: f.destinationCity, origin: f.origin, tripYear: intOrNaN(f.tripYear),
    tripStart: f.tripStart || null, tripEnd: f.tripEnd || null, days: intOrNaN(f.days), nights: intOrNaN(f.nights),
    expectedStudents: intOrNaN(f.expectedStudents), budgetPerStudent: money('budgetPerStudent'), monthlyFee: money('monthlyFee'),
    months: intOrNaN(f.months), startMonth: f.startMonth || null, dueDay: intOrNaN(f.dueDay), latePenalty: pct('latePenalty'),
    refundOnWithdrawal: pct('refundOnWithdrawal'), annualRate: pct('annualRate'), admin: f.admin, supervisor: f.supervisor,
    newJoinersPayPast: f.newJoinersPayPast, provisional: f.provisional,
  }
  return { s, errors: { ...validateSettings(s), ...errors } }
}

function SettingsForm({ open, current, pendingExists, onClose, onSaved }: {
  open: boolean; current: ProjectSettings; pendingExists: boolean; onClose: () => void; onSaved: (r: { version: number | null; proposal: number | null }) => void
}) {
  const [f, setF] = useState<FormState>(() => toForm(current))
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tried, setTried] = useState(false)
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) { setLastOpen(open); if (open) { setF(toForm(current)); setReason(''); setError(null); setTried(false) } }

  const { s, errors } = useMemo(() => fromForm(f), [f])
  const changes = useMemo(() => (Object.keys(errors).length ? [] : diffSettings(toDb(current), toDb(s))), [current, s, errors])
  const financial = changes.filter((c) => c.financial)
  const set = (k: keyof FormState) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const err = (k: keyof ProjectSettings) => (tried ? errors[k] : undefined)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTried(true)
    if (Object.keys(errors).length) { setError('Corrija os campos marcados.'); return }
    if (!changes.length) { setError('Nada foi alterado.'); return }
    if (financial.length && pendingExists) { setError('Já existe uma mudança de regra aguardando o professor. Cancele-a ou espere a decisão antes de propor outra.'); return }
    if (reason.trim().length < 3) { setError('Explique o motivo da alteração.'); return }
    setBusy(true); setError(null)
    try { onSaved(await proposeSettings(s, reason)) }
    catch (x) { setError((x as Error).message) }
    finally { setBusy(false) }
  }

  const L = ({ k, children }: { k: DbKey; children: string }) => (
    <span className="inline-flex items-center gap-1.5">{children}{FINANCIAL_KEYS.includes(k) && <Tooltip content="Muda só com aprovação do professor"><Lock size={12} className="text-faint" aria-label="exige aprovação" /></Tooltip>}</span>
  )

  return (
    <Modal wide open={open} onClose={onClose} title="Editar configurações"
      description="Mudanças em campos com cadeado vão para aprovação do professor. As demais valem na hora."
      footer={<>
        {error && <p role="alert" className="mr-auto text-sm text-bad">{error}</p>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" type="submit" form="settings-form" loading={busy}>
          {financial.length && financial.length === changes.length ? 'Enviar para aprovação' : 'Salvar'}
        </Button>
      </>}>
      <form id="settings-form" onSubmit={submit} className="space-y-7">
        <fieldset className="grid gap-4 sm:grid-cols-3">
          <legend className="text-[13px] font-semibold text-ink mb-3">Viagem</legend>
          <Field label="Destino" error={err('destination')}>{(id) => <Input id={id} maxLength={80} value={f.destination} onChange={set('destination')} />}</Field>
          <Field label="Cidade do destino" error={err('destinationCity')}>{(id) => <Input id={id} maxLength={80} value={f.destinationCity} onChange={set('destinationCity')} />}</Field>
          <Field label="Saída" error={err('origin')}>{(id) => <Input id={id} maxLength={80} value={f.origin} onChange={set('origin')} />}</Field>
          <Field label="Ano" error={err('tripYear')}>{(id) => <Input id={id} inputMode="numeric" value={f.tripYear} onChange={set('tripYear')} />}</Field>
          <Field label="Ida (opcional)" error={err('tripStart')}>{(id) => <Input id={id} type="date" value={f.tripStart} onChange={set('tripStart')} />}</Field>
          <Field label="Volta (opcional)" error={err('tripEnd')}>{(id) => <Input id={id} type="date" value={f.tripEnd} onChange={set('tripEnd')} />}</Field>
          <Field label="Dias" error={err('days')}>{(id) => <Input id={id} inputMode="numeric" value={f.days} onChange={set('days')} />}</Field>
          <Field label="Noites" error={err('nights')}>{(id) => <Input id={id} inputMode="numeric" value={f.nights} onChange={set('nights')} />}</Field>
          <Field label="Participantes previstos" error={err('expectedStudents')}>{(id) => <Input id={id} inputMode="numeric" value={f.expectedStudents} onChange={set('expectedStudents')} />}</Field>
          <Field label="Orçamento por aluno" hint="Estimativa, até cotar" error={err('budgetPerStudent')}>{(id) => <Input id={id} prefix="R$" inputMode="decimal" value={f.budgetPerStudent} onChange={set('budgetPerStudent')} />}</Field>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-3">
          <legend className="text-[13px] font-semibold text-ink mb-3">Mensalidades</legend>
          <Field label={<L k="mensalidade">Mensalidade</L>} error={err('monthlyFee')}>{(id) => <Input id={id} prefix="R$" inputMode="decimal" value={f.monthlyFee} onChange={set('monthlyFee')} />}</Field>
          <Field label={<L k="parcelas">Parcelas</L>} error={err('months')}>{(id) => <Input id={id} inputMode="numeric" value={f.months} onChange={set('months')} />}</Field>
          <Field label={<L k="mes_inicio">Mês da 1ª parcela</L>} hint={f.startMonth && !errors.startMonth && !errors.months ? `Última: ${monthLabel(lastMonth(f.startMonth, s.months))}` : 'Necessário para gerar parcelas'} error={err('startMonth')}>
            {(id) => <Input id={id} type="month" value={f.startMonth} onChange={set('startMonth')} />}
          </Field>
          <Field label={<L k="dia_vencimento">Dia de vencimento</L>} hint="De 1 a 28" error={err('dueDay')}>{(id) => <Input id={id} inputMode="numeric" value={f.dueDay} onChange={set('dueDay')} />}</Field>
          <Field label={<L k="adicional_atraso_bp">Adicional por atraso (%)</L>} hint="Sobre o que faltar no vencimento" error={err('latePenalty')}>{(id) => <Input id={id} inputMode="decimal" value={f.latePenalty} onChange={set('latePenalty')} />}</Field>
          <Field label={<L k="devolucao_desistencia_bp">Devolução na desistência (%)</L>} error={err('refundOnWithdrawal')}>{(id) => <Input id={id} inputMode="decimal" value={f.refundOnWithdrawal} onChange={set('refundOnWithdrawal')} />}</Field>
          <div className="sm:col-span-3 space-y-3 pt-1">
            <Check label={<L k="novos_pagam_anteriores">Quem entra depois paga as parcelas que já venceram</L>} checked={f.newJoinersPayPast} onChange={(e) => setF({ ...f, newJoinersPayPast: e.target.checked })} />
            <Check label={<L k="provisorio">Regras ainda provisórias</L>} hint="Desmarque quando as regras forem definitivas. Parcelas só podem ser geradas com regras aprovadas."
              checked={f.provisional} onChange={(e) => setF({ ...f, provisional: e.target.checked })} />
          </div>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-3">
          <legend className="text-[13px] font-semibold text-ink mb-3">Rendimento e governança</legend>
          <Field label="Rendimento anual (%)" hint="Só para projeções" error={err('annualRate')}>{(id) => <Input id={id} inputMode="decimal" value={f.annualRate} onChange={set('annualRate')} />}</Field>
          <Field label="Administração" error={err('admin')}>{(id) => <Input id={id} maxLength={80} value={f.admin} onChange={set('admin')} />}</Field>
          <Field label="Professor supervisor" error={err('supervisor')}>{(id) => <Input id={id} maxLength={80} value={f.supervisor} onChange={set('supervisor')} />}</Field>
        </fieldset>

        <div className="rounded-md bg-raised ring-1 ring-line p-4 text-sm">
          {!changes.length ? <p className="text-muted">Nenhuma mudança ainda.</p> : <>
            <p className="font-medium">{changes.length} {changes.length === 1 ? 'mudança' : 'mudanças'}</p>
            <ul className="mt-2 space-y-1 text-[13px]">
              {changes.map((c) => (
                <li key={c.key} className="flex flex-wrap items-center gap-x-2 num">
                  <span className="text-muted">{LABELS[c.key]}:</span> {formatSettingValue(c.key, c.from)} → <b className="font-medium">{formatSettingValue(c.key, c.to)}</b>
                  {c.financial ? <Badge tone="gold">Aguarda professor</Badge> : <Badge tone="ok">Na hora</Badge>}
                </li>
              ))}
            </ul>
          </>}
        </div>
        <Field label="Motivo da alteração" hint="Fica registrado no histórico">{(id) => <Textarea id={id} required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: valores combinados na reunião de pais de 10/03" />}</Field>
      </form>
    </Modal>
  )
}
