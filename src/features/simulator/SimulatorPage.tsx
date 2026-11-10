import { useMemo, useState } from 'react'
import { Calculator, Info, Pin, RotateCcw, X } from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import { scenario, type Scenario } from '@/lib/finance'
import { money, moneyShort, percent } from '@/lib/format'
import { AnimatedNumber, Badge, Button, Card, CardHeader, PageHeader, RangeField, Tooltip, useToast } from '@/components/ui'
import { ChartLegend, ProjectionChart, c } from '@/components/charts'

interface Params { students: number; monthly: number; months: number; rate: number; budget: number; extra: number }
interface Pinned { id: number; name: string; p: Params; sc: Scenario }

const LIMITS = {
  students: { min: 5, max: 60, step: 1 }, monthly: { min: 20, max: 300, step: 5 }, months: { min: 6, max: 30, step: 1 },
  rate: { min: 0, max: 15, step: 0.5 }, budget: { min: 1000, max: 5000, step: 50 }, extra: { min: 0, max: 20000, step: 250 },
} as const
const clamp = (k: keyof Params, v: number) => {
  const l = LIMITS[k]; const x = Math.min(l.max, Math.max(l.min, Number.isFinite(v) ? v : l.min))
  return k === 'students' || k === 'months' ? Math.round(x) : x
}
const run = (p: Params): Scenario => scenario({
  monthly: Math.round(p.monthly * 100), months: p.months, annualRate: p.rate / 100,
  students: p.students, budgetPerStudent: Math.round(p.budget * 100), extraRevenue: Math.round(p.extra * 100),
})
const LETTERS = ['A', 'B', 'C']

/** Simulação local (não grava). Usa scenario() de lib/finance, coberto por testes. */
export function SimulatorPage() {
  const s = useSettings()
  const toast = useToast()
  const initial: Params = { students: s.expectedStudents, monthly: s.monthlyFee / 100, months: s.months, rate: s.annualRate * 100, budget: s.budgetPerStudent / 100, extra: 0 }
  const [raw, setRaw] = useState<Params>(initial)
  const [pinned, setPinned] = useState<Pinned[]>([])
  const p = useMemo(() => Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, clamp(k as keyof Params, v)])) as unknown as Params, [raw])
  const sc = useMemo(() => run(p), [p])
  const set = (k: keyof Params) => (v: number) => setRaw((r) => ({ ...r, [k]: v }))

  const deposited = sc.perStudentDeposited * p.students
  const yieldTotal = (sc.perStudentBalance - sc.perStudentDeposited) * p.students
  const extra = Math.round(p.extra * 100)
  const scale = Math.max(sc.groupBudget, sc.groupBalance)
  const seg = (v: number) => `${scale ? (v / scale) * 100 : 0}%`
  const needed = sc.gap > 0 ? sc.gap / p.students / p.months : 0

  const pin = () => {
    if (pinned.length >= 3) { toast('Limite de 3 cenários. Remova um para fixar outro.', 'error'); return }
    const name = LETTERS.find((l) => !pinned.some((x) => x.name === l))!
    setPinned((x) => [...x, { id: Date.now(), name, p, sc }])
    toast(`Cenário ${name} fixado para comparação`)
  }

  return (
    <>
      <PageHeader icon={Calculator} section="Financeiro" title="Simulador"
        description="Ajuste os parâmetros e veja, na hora, quanto a turma junta e quanto falta. Nada aqui é gravado."
        actions={<>
          <Button icon={RotateCcw} onClick={() => setRaw(initial)}>Restaurar</Button>
          <Button variant="primary" icon={Pin} onClick={pin}>Fixar cenário</Button>
        </>} />

      <div className="grid gap-6 lg:grid-cols-[340px_1fr] items-start">
        <Card className="lg:sticky lg:top-8">
          <CardHeader title="Parâmetros" hint="Arraste ou digite um valor" />
          <div className="px-5 pb-5 space-y-6">
            <div>
              <p className="text-[12px] text-faint mb-2">Mensalidade rápida</p>
              <div className="flex gap-2">
                {[50, 75, 100].map((v) => (
                  <button key={v} onClick={() => set('monthly')(v)} aria-pressed={p.monthly === v}
                    className={`flex-1 h-8 rounded-sm text-[13px] font-medium num transition-all ${p.monthly === v ? 'bg-accent text-accent-ink shadow-sm' : 'bg-sunken text-muted hover:text-ink'}`}>
                    R$ {v}
                  </button>
                ))}
              </div>
            </div>
            <RangeField label="Participantes" {...LIMITS.students} value={raw.students} onChange={set('students')} format={(v) => `${v}`} unit="alunos" />
            <RangeField label="Mensalidade por aluno" {...LIMITS.monthly} value={raw.monthly} onChange={set('monthly')} format={(v) => `R$ ${v}`} unit="R$" />
            <RangeField label="Período" {...LIMITS.months} value={raw.months} onChange={set('months')} format={(v) => `${v}`} unit="meses" />
            <div className="h-px bg-line" />
            <RangeField label="Orçamento por aluno" {...LIMITS.budget} value={raw.budget} onChange={set('budget')} format={(v) => `R$ ${v.toLocaleString('pt-BR')}`} unit="R$" />
            <RangeField label="Outras arrecadações (total)" {...LIMITS.extra} value={raw.extra} onChange={set('extra')} format={(v) => `R$ ${(v / 1000).toLocaleString('pt-BR')} mil`} unit="R$" />
            <RangeField label="Rendimento anual" {...LIMITS.rate} value={raw.rate} onChange={set('rate')} format={(v) => `${v.toLocaleString('pt-BR')}%`} unit="% a.a." />
          </div>
        </Card>

        <div className="space-y-6 min-w-0">
          {/* resultado principal */}
          <Card className="overflow-hidden">
            <div className="p-6 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[13px] text-muted">Saldo do grupo ao fim de {p.months} meses</p>
                  <p className="font-display font-bold tracking-[-0.035em] text-[44px] sm:text-[52px] leading-none mt-2">
                    <AnimatedNumber value={sc.groupBalance} format={moneyShort} />
                  </p>
                </div>
                <div className={`rounded-md px-4 py-3 ${sc.gap > 0 ? 'bg-warn/10' : 'bg-ok/10'}`}>
                  <p className={`text-[12px] font-medium ${sc.gap > 0 ? 'text-warn' : 'text-ok'}`}>{sc.gap > 0 ? 'Faltam' : 'Sobram'}</p>
                  <p className="num font-display text-2xl font-bold mt-0.5"><AnimatedNumber value={Math.abs(sc.gap)} format={moneyShort} /></p>
                </div>
              </div>

              {/* barra de composição até a meta */}
              <div className="mt-7">
                <div className="flex justify-between text-[12px] text-muted mb-2">
                  <span className="num">Cobertura de <b className="text-ink">{percent(sc.coverage)}</b></span>
                  <span className="num">Meta {moneyShort(sc.groupBudget)}</span>
                </div>
                <div className="relative h-4 rounded-full bg-sunken overflow-hidden flex" role="img"
                  aria-label={`Depositado ${moneyShort(deposited)}, rendimento ${moneyShort(yieldTotal)}, outras arrecadações ${moneyShort(extra)}, meta ${moneyShort(sc.groupBudget)}`}>
                  <span className="h-full bg-accent transition-[width] duration-500 ease-out" style={{ width: seg(deposited) }} />
                  <span className="h-full bg-gold transition-[width] duration-500 ease-out" style={{ width: seg(yieldTotal) }} />
                  <span className="h-full bg-ok transition-[width] duration-500 ease-out" style={{ width: seg(extra) }} />
                  {sc.groupBalance > sc.groupBudget && <span className="absolute top-0 bottom-0 w-0.5 bg-ink/70" style={{ left: seg(sc.groupBudget) }} aria-hidden />}
                </div>
                <div className="mt-3"><ChartLegend items={[
                  { label: `Depositado ${moneyShort(deposited)}`, color: c('accent') },
                  { label: `Rendimento ${moneyShort(yieldTotal)}`, color: c('gold') },
                  { label: `Outras arrecadações ${moneyShort(extra)}`, color: c('ok') },
                ]} /></div>
              </div>
            </div>
            <dl className="grid grid-cols-2 sm:grid-cols-4 border-t border-line bg-raised [&>div]:px-6 [&>div]:py-4 [&>div]:border-line [&>div:nth-child(odd)]:border-r sm:[&>div]:border-r sm:[&>div:last-child]:border-r-0 [&>div:nth-child(-n+2)]:border-b sm:[&>div]:border-b-0">
              <div><dt className="text-[12px] text-faint">Depositado por aluno</dt><dd className="num font-semibold mt-1">{money(sc.perStudentDeposited)}</dd></div>
              <div><dt className="text-[12px] text-faint">Saldo por aluno</dt><dd className="num font-semibold mt-1">{money(sc.perStudentBalance)}</dd></div>
              <div><dt className="text-[12px] text-faint">Rendimento por aluno</dt><dd className="num font-semibold mt-1">{money(sc.perStudentBalance - sc.perStudentDeposited)}</dd></div>
              <div><dt className="flex items-center gap-1 text-[12px] text-faint">Para fechar a meta
                <Tooltip content="Valor extra por aluno, por mês, sem considerar rendimento sobre ele."><button type="button" aria-label="Como é calculado" className="text-faint hover:text-muted"><Info size={12} /></button></Tooltip></dt>
                <dd className="num font-semibold mt-1">{needed > 0 ? `+ ${money(Math.ceil(needed))}/mês` : 'Meta coberta'}</dd></div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Evolução do saldo" hint="Somente mensalidades e rendimento, mês a mês" />
            <div className="px-5 pb-5">
              <ChartLegend items={[{ label: 'Depositado', color: c('accent') }, { label: 'Rendimento', color: c('gold') }, { label: 'Meta', color: c('ink', 0.45), dashed: true }]} />
              <div className="mt-3"><ProjectionChart monthly={Math.round(p.monthly * 100)} months={p.months} annualRate={p.rate / 100} students={p.students} budget={sc.groupBudget} /></div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Comparar cenários" hint="Fixe até três combinações e compare com o cenário atual"
              action={pinned.length > 0 && <Badge tone="accent">{pinned.length} de 3</Badge>} />
            {pinned.length === 0 ? (
              <div className="mx-5 mb-5 rounded-md border border-dashed border-line px-5 py-8 text-center">
                <Pin size={18} className="mx-auto text-faint" aria-hidden />
                <p className="text-sm text-muted mt-2">Use “Fixar cenário” para guardar a combinação atual e comparar com outras.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm num">
                  <thead><tr className="border-y border-line text-xs text-faint">
                    <th scope="col" className="text-left font-medium px-5 h-10">Cenário</th>
                    {['Alunos', 'Mensalidade', 'Meses', 'Taxa', 'Saldo', 'Cobertura', 'Diferença'].map((h) => <th key={h} scope="col" className="text-right font-medium px-3 h-10 whitespace-nowrap">{h}</th>)}
                    <th className="w-10"><span className="sr-only">Remover</span></th>
                  </tr></thead>
                  <tbody>
                    {[...pinned, { id: 0, name: 'Atual', p, sc }].map((x) => (
                      <tr key={x.id} className={`border-b border-line/70 last:border-0 ${x.id === 0 ? 'bg-accent/[0.04]' : ''}`}>
                        <td className="px-5 h-12 font-semibold">{x.id === 0 ? <span className="text-accent">Atual</span> : `Cenário ${x.name}`}</td>
                        <td className="px-3 text-right">{x.p.students}</td>
                        <td className="px-3 text-right">{moneyShort(Math.round(x.p.monthly * 100))}</td>
                        <td className="px-3 text-right">{x.p.months}</td>
                        <td className="px-3 text-right">{x.p.rate.toLocaleString('pt-BR')}%</td>
                        <td className="px-3 text-right font-medium">{moneyShort(x.sc.groupBalance)}</td>
                        <td className="px-3 text-right">{percent(x.sc.coverage)}</td>
                        <td className={`px-3 text-right font-medium ${x.sc.gap > 0 ? 'text-warn' : 'text-ok'}`}>{x.sc.gap > 0 ? '−' : '+'}{moneyShort(Math.abs(x.sc.gap))}</td>
                        <td className="pr-3 text-right">{x.id !== 0 && (
                          <button onClick={() => setPinned((ps) => ps.filter((y) => y.id !== x.id))} aria-label={`Remover cenário ${x.name}`} className="p-1.5 rounded-sm text-faint hover:text-bad hover:bg-bad/10"><X size={14} /></button>
                        )}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <p className="text-xs text-faint">Depósitos no fim de cada mês, taxa mensal equivalente à anual. Valores hipotéticos, sem garantia de rendimento.</p>
        </div>
      </div>
    </>
  )
}
