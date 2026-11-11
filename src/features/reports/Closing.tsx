import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarCheck, CheckCircle2, FileDown, Landmark, Plus, Scale, Sprout, Target, TriangleAlert } from 'lucide-react'
import { Badge, Button, Card, CardHeader, Field, Input, Modal, Select, cx } from '@/components/ui'
import { addBankBalance, type BankBalance } from '@/data/checks'
import { dateBR, today } from '@/data/useRemote'
import { money, moneyShort } from '@/lib/format'
import { parseMoney } from '@/lib/payments'
import { monthClosing, previousMonth, reconcile, type MonthClosing } from '@/lib/closing'
import { ORIGIN_LABEL, type LedgerEntry } from '@/lib/ledger'
import { monthLabel } from '@/lib/settings'
import { br, esc, openPrint } from './print'

// ---------------------------------------------------------------- saldos e conciliação
/**
 * Quatro leituras que não podem se confundir: o que está registrado no sistema, o que o banco
 * mostra (informado do extrato), quanto rendeu de verdade e a projeção (ilustrativa).
 */
export function BalancesCard({ ledger, bank, bankAvailable, yields, projection, canInform, onInformed }: {
  ledger: LedgerEntry[]; bank: BankBalance | null; bankAvailable: boolean; yields: number
  projection: { balance: number; goal: number }; canInform: boolean; onInformed: () => void
}) {
  const [open, setOpen] = useState(false)
  const registered = ledger.reduce((s, e) => s + e.amount, 0)
  const rec = reconcile(ledger, bank ? { date: bank.date, amount: bank.amount } : null)
  const tile = 'p-5 border-line'
  return (
    <Card className="overflow-hidden">
      <CardHeader title={<span className="flex items-center gap-2"><Scale size={16} className="text-accent" aria-hidden />Saldos</span>}
        hint="O registrado no sistema precisa bater com o extrato. Projeção é só referência."
        action={canInform && bankAvailable && <Button size="sm" icon={Plus} onClick={() => setOpen(true)}>Informar saldo do extrato</Button>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-line [&>div:nth-child(odd)]:border-r lg:[&>div]:border-r lg:[&>div:last-child]:border-r-0 [&>div:nth-child(-n+2)]:border-b lg:[&>div]:border-b-0">
        <div className={tile}>
          <p className="flex items-center gap-2 text-[13px] text-muted"><Landmark size={15} aria-hidden />Saldo registrado</p>
          <p className="num font-display text-[26px] font-bold tracking-[-0.02em] mt-2">{money(registered)}</p>
          <p className="text-xs text-faint mt-1.5">Soma do livro-caixa hoje</p>
        </div>
        <div className={tile}>
          <p className="flex items-center gap-2 text-[13px] text-muted"><Landmark size={15} aria-hidden />Saldo no banco</p>
          {rec ? <>
            <p className="num font-display text-[26px] font-bold tracking-[-0.02em] mt-2">{money(rec.bank)}</p>
            <p className={cx('text-xs mt-1.5 flex items-center gap-1', rec.difference === 0 ? 'text-ok' : 'text-warn')}>
              {rec.difference === 0 ? <><CheckCircle2 size={13} aria-hidden />Bate com o registrado em {dateBR(rec.date)}</>
                : <><TriangleAlert size={13} aria-hidden />Diferença de {money(rec.difference)} em {dateBR(rec.date)}</>}
            </p>
          </> : <>
            <p className="font-display text-[20px] font-bold text-faint mt-2.5">Não informado</p>
            <p className="text-xs text-faint mt-1.5">{bankAvailable ? 'Informe o saldo do extrato para conferir' : 'Disponível após a migração 0008'}</p>
          </>}
        </div>
        <div className={tile}>
          <p className="flex items-center gap-2 text-[13px] text-muted"><Sprout size={15} aria-hidden />Rendimentos reais</p>
          <p className="num font-display text-[26px] font-bold tracking-[-0.02em] mt-2">{money(yields)}</p>
          <p className="text-xs text-faint mt-1.5">Lançados conforme extrato</p>
        </div>
        <div className={cx(tile, 'bg-gold/[0.06]')}>
          <p className="flex items-center gap-2 text-[13px] text-muted"><Target size={15} aria-hidden />Projeção <Badge tone="gold">Ilustrativa</Badge></p>
          <p className="num font-display text-[26px] font-bold tracking-[-0.02em] mt-2 text-muted">{moneyShort(projection.balance)}</p>
          <p className="text-xs text-faint mt-1.5">Ao fim das parcelas · meta {moneyShort(projection.goal)}</p>
        </div>
      </div>
      <BankForm open={open} onClose={() => setOpen(false)} onSaved={onInformed} />
    </Card>
  )
}

function BankForm({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ date: today(), amount: '', institution: '', note: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (open) { setF({ date: today(), amount: '', institution: '', note: '' }); setError(null) } }, [open])
  async function submit(e: FormEvent) {
    e.preventDefault()
    const neg = f.amount.trim().startsWith('-')
    const cents = f.amount.trim().replace(/^-/, '').replace(/[R$\s]/g, '') === '0' ? 0 : parseMoney(f.amount.replace(/^\s*-/, ''))
    if (cents === null) { setError('Valor inválido. Ex.: 7.510,80'); return }
    if (f.date > today()) { setError('A data não pode ser no futuro.'); return }
    setBusy(true); setError(null)
    try { await addBankBalance({ ...f, amount: neg ? -cents : cents }); onClose(); onSaved() }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Informar saldo do extrato" description="Copie o saldo que o banco mostra no fim do dia escolhido. O sistema compara com o registrado até essa data."
      footer={<>
        {error && <p role="alert" className="mr-auto text-sm text-bad">{error}</p>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" type="submit" form="bank-form" loading={busy}>Salvar</Button>
      </>}>
      <form id="bank-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Data do extrato">{(id) => <Input id={id} type="date" required max={today()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />}</Field>
        <Field label="Saldo">{(id) => <Input id={id} prefix="R$" inputMode="decimal" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0,00" />}</Field>
        <Field label="Banco ou aplicação" hint="Opcional">{(id) => <Input id={id} maxLength={120} value={f.institution} onChange={(e) => setF({ ...f, institution: e.target.value })} />}</Field>
        <Field label="Observação" hint="Opcional">{(id) => <Input id={id} maxLength={300} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />}</Field>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------- fechamento mensal
type ClosingInput = Omit<Parameters<typeof monthClosing>[0], 'month'>

/** Resumo de um mês fechado, com PDF. Só soma o que foi registrado. */
export function MonthClosingCard({ input, checksAvailable, ledger, generatedBy, onError }: {
  input: ClosingInput; checksAvailable: boolean; ledger: LedgerEntry[]; generatedBy: string | null; onError: (m: string) => void
}) {
  const current = today().slice(0, 7)
  const months = useMemo(() => {
    const first = ledger.reduce((m, e) => (e.date.slice(0, 7) < m ? e.date.slice(0, 7) : m), current)
    const out: string[] = []
    for (let m = current; m >= first; m = previousMonth(m)) out.push(m)
    return out
  }, [ledger, current])
  const [month, setMonth] = useState(() => previousMonth(current))
  const sel = months.includes(month) ? month : months[0]
  const c = useMemo(() => monthClosing({ ...input, month: sel }), [input, sel])
  const partial = sel === current

  function pdf() {
    try { printClosing(c, ledger, checksAvailable, partial, generatedBy) } catch (e) { onError((e as Error).message) }
  }
  const row = (k: string, v: string, tone?: 'bad' | 'warn' | 'ok') => (
    <div className="flex justify-between gap-4 py-2.5"><dt className="text-muted">{k}</dt><dd className={cx('num font-medium', tone === 'bad' && 'text-bad', tone === 'warn' && 'text-warn', tone === 'ok' && 'text-ok')}>{v}</dd></div>
  )
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2"><CalendarCheck size={16} className="text-accent" aria-hidden />Fechamento mensal</span>}
        hint={partial ? 'Mês em andamento: valores parciais.' : 'Resumo do mês escolhido, pronto para enviar aos pais e à escola.'}
        action={<div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="closing-month">Mês</label>
          <Select id="closing-month" value={sel} onChange={(e) => setMonth(e.target.value)} className="h-8 text-[13px]">{months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</Select>
          <Button size="sm" variant="primary" icon={FileDown} onClick={pdf}>PDF</Button>
        </div>} />
      <div className="px-5 pb-5 grid gap-x-10 sm:grid-cols-2 text-sm">
        <dl className="divide-y divide-line/70">
          {row('Saldo inicial', money(c.opening))}
          {row('Mensalidades', money(c.tuition))}
          {row('Arrecadações (líquido)', money(c.fundraisingNet))}
          {row('Rendimentos', money(c.yields))}
          {row('Despesas', money(-c.expenses), c.expenses ? 'bad' : undefined)}
          <div className="flex justify-between gap-4 py-2.5 font-semibold"><dt>Saldo final</dt><dd className="num">{money(c.closing)}</dd></div>
        </dl>
        <dl className="divide-y divide-line/70">
          {row('Parcelas em atraso no fim do mês', c.lateCount ? `${c.lateCount} (${c.lateStudents} ${c.lateStudents === 1 ? 'aluno' : 'alunos'})` : 'Nenhuma', c.lateCount ? 'bad' : 'ok')}
          {row('Valor em atraso', money(c.lateAmount), c.lateAmount ? 'bad' : undefined)}
          {row('Despesas sem comprovante', c.noReceiptCount ? `${c.noReceiptCount} · ${money(c.noReceiptAmount)}` : 'Nenhuma', c.noReceiptCount ? 'warn' : 'ok')}
          {checksAvailable && row('Lançamentos a conferir', c.uncheckedCount ? String(c.uncheckedCount) : 'Todos conferidos', c.uncheckedCount ? 'warn' : 'ok')}
          {row('Resultado do mês', money(c.inflow - c.outflow), c.inflow - c.outflow < 0 ? 'bad' : undefined)}
        </dl>
      </div>
    </Card>
  )
}

function printClosing(c: MonthClosing, ledger: LedgerEntry[], checksAvailable: boolean, partial: boolean, by: string | null) {
  const from = `${c.month}-01`, to = `${c.month}-31`
  const entries = ledger.filter((e) => e.date >= from && e.date <= to).sort((a, b) => a.date.localeCompare(b.date))
  const tr = (k: string, v: string, cls = '') => `<tr><td>${esc(k)}</td><td class="n ${cls}">${esc(v)}</td></tr>`
  openPrint(`Fechamento ${monthLabel(c.month)} — Monte Trip 2028`, `
<h1>Fechamento de ${esc(monthLabel(c.month))}${partial ? ' (parcial)' : ''}</h1>
<p class="muted">Monte Trip 2028 · Gerado em ${new Date().toLocaleString('pt-BR')}${by ? ` por ${esc(by)}` : ''}</p>
<div class="grid">
  <div class="box">Saldo inicial<b>${money(c.opening)}</b></div><div class="box">Entradas<b>${money(c.inflow)}</b></div>
  <div class="box">Saídas<b>${money(c.outflow)}</b></div><div class="box">Saldo final<b>${money(c.closing)}</b></div>
</div>
<h2>Movimento do mês</h2>
<table><tbody>${tr('Mensalidades (estornos descontados)', money(c.tuition))}${tr('Arrecadações (receitas − custos)', money(c.fundraisingNet))}
${tr('Rendimentos (conforme extrato)', money(c.yields))}${tr('Despesas', money(-c.expenses))}${tr('Resultado do mês', money(c.inflow - c.outflow))}</tbody></table>
<h2>Pendências no fim do mês</h2>
<table><tbody>${tr('Parcelas em atraso', c.lateCount ? `${c.lateCount} de ${c.lateStudents} aluno(s)` : 'nenhuma', c.lateCount ? 'warn' : '')}
${tr('Valor em atraso (com adicional)', money(c.lateAmount), c.lateAmount ? 'warn' : '')}
${tr('Despesas sem comprovante', c.noReceiptCount ? `${c.noReceiptCount} · ${money(c.noReceiptAmount)}` : 'nenhuma', c.noReceiptCount ? 'warn' : '')}
${checksAvailable ? tr('Lançamentos ainda não conferidos', String(c.uncheckedCount), c.uncheckedCount ? 'warn' : '') : ''}</tbody></table>
<h2>Lançamentos (${entries.length})</h2>
${entries.length ? `<table><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th class="n">Valor</th></tr></thead><tbody>
${entries.map((e) => `<tr><td>${br(e.date)}</td><td>${esc(ORIGIN_LABEL[e.origin])}${e.reversal ? ' (estorno)' : ''}</td><td>${esc(e.origin === 'mensalidade' ? 'Mensalidade' : e.description ?? '')}</td><td class="n">${money(e.amount)}</td></tr>`).join('')}
</tbody></table>` : '<p class="muted">Nenhum lançamento no mês.</p>'}
<footer>Dados registrados no sistema. Nomes de alunos não aparecem neste relatório. Lançamentos não são editados: correções aparecem como estornos. Confira com o extrato bancário.</footer>`)
}
