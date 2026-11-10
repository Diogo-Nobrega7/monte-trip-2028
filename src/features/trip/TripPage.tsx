import { BedDouble, Bus, CalendarDays, MapPin, Plane, ShieldCheck, Ticket, Users, Utensils, Wallet } from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import { moneyShort } from '@/lib/format'
import { Badge, Card, CardHeader, PageHeader, StageNotice } from '@/components/ui'
import { STAGE2 } from '../stage'

const SERVICES = [
  { icon: Bus, name: 'Transporte', detail: 'Ida e volta a partir de Natal' },
  { icon: BedDouble, name: 'Hospedagem', detail: 'Três noites' },
  { icon: Ticket, name: 'Ingressos', detail: 'Parque aquático' },
  { icon: Utensils, name: 'Alimentação', detail: 'Refeições durante a estadia' },
  { icon: ShieldCheck, name: 'Acompanhamento', detail: 'Monitores e responsáveis' },
]
// Sequência real do projeto, por isso numerada.
const MILESTONES = [
  'Aprovar regulamento e regras', 'Abrir conta e iniciar mensalidades', 'Ações de arrecadação', 'Cotar e comparar agências',
  'Contratar agência e reservar datas', 'Coletar autorizações', 'Viagem', 'Prestação de contas final',
]

export function TripPage() {
  const s = useSettings()
  const facts = [
    { icon: CalendarDays, k: 'Ano', v: String(s.tripYear) },
    { icon: Plane, k: 'Duração', v: `${s.days} dias, ${s.nights} noites` },
    { icon: Users, k: 'Participantes', v: `cerca de ${s.expectedStudents}` },
    { icon: Wallet, k: 'Orçamento por aluno', v: moneyShort(s.budgetPerStudent) },
  ]
  return (
    <>
      <PageHeader icon={Plane} section="Organização" title="Viagem" description="O que está planejado. Tudo aqui é provisório até a contratação da agência." />
      <StageNotice>{STAGE2}</StageNotice>
      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Card className="overflow-hidden">
          <div className="relative p-6 sm:p-7 bg-[linear-gradient(135deg,rgb(var(--accent)/.10),transparent_60%)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-1.5 text-[13px] text-muted"><MapPin size={14} aria-hidden />{s.destinationCity}</p>
                <p className="font-display text-[32px] leading-tight font-bold tracking-[-0.025em] mt-1">{s.destination}</p>
                <p className="text-sm text-muted mt-1">Saída de {s.origin}. Datas ainda não definidas.</p>
              </div>
              <Badge tone="gold">Provisório</Badge>
            </div>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 border-t border-line [&>div]:p-5 [&>div]:border-line [&>div:nth-child(odd)]:border-r sm:[&>div]:border-r sm:[&>div:last-child]:border-r-0 [&>div:nth-child(-n+2)]:border-b sm:[&>div]:border-b-0">
            {facts.map((f) => (
              <div key={f.k}><dt className="flex items-center gap-1.5 text-[12px] text-faint"><f.icon size={13} aria-hidden />{f.k}</dt><dd className="num font-semibold mt-1.5">{f.v}</dd></div>
            ))}
          </dl>
        </Card>
        <Card>
          <CardHeader title="Serviços desejados" hint="Cada item será cotado com as agências" />
          <ul className="px-5 pb-4">
            {SERVICES.map((x) => (
              <li key={x.name} className="flex items-center gap-3.5 py-2.5 border-b border-line/70 last:border-0">
                <span className="grid place-items-center size-9 rounded-md bg-accent/10 text-accent"><x.icon size={17} aria-hidden /></span>
                <div className="flex-1 min-w-0"><p className="text-sm font-medium">{x.name}</p><p className="text-[12px] text-muted">{x.detail}</p></div>
                <Badge>A cotar</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <section aria-labelledby="timeline" className="mt-10">
        <h2 id="timeline" className="font-display text-xl font-bold tracking-[-0.015em]">Linha do tempo</h2>
        <p className="text-sm text-muted mt-1 mb-6">Da aprovação das regras à prestação de contas.</p>
        <ol className="relative grid gap-5 sm:grid-cols-4 lg:grid-cols-8 before:hidden lg:before:block before:absolute before:left-3.5 before:right-3.5 before:top-3.5 before:h-px before:bg-line">
          {MILESTONES.map((m, i) => (
            <li key={m} className="relative flex lg:flex-col gap-3">
              <span className={`relative num grid place-items-center size-7 rounded-full text-xs font-semibold shrink-0 ring-4 ring-bg ${i === 0 ? 'bg-accent text-accent-ink' : i === 6 ? 'bg-gold text-gold-ink' : 'bg-surface text-muted ring-1'}`}>{i + 1}</span>
              <p className={`text-[13px] leading-snug ${i === 0 ? 'text-ink font-medium' : 'text-muted'}`}>{m}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
