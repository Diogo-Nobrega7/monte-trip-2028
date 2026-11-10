import { AnimatedNumber, Tooltip } from '@/components/ui'
import { moneyShort, percent } from '@/lib/format'
import type { Cents } from '@/types/domain'

/**
 * Peça de identidade do painel: um bilhete de viagem.
 * A trilha entre origem e destino é o progresso financeiro da turma.
 *  - ponto dourado sólido = arrecadado de fato
 *  - marcador vazado = onde o cenário ilustrativo chega no fim do período
 */
export function JourneyTicket(p: {
  greeting: string; raised: Cents; budget: Cents; projected: number; months: number
  origin: string; destination: string; destinationCity: string
  year: number; days: number; nights: number; enrolled: number; expected: number
}) {
  const real = p.budget > 0 ? Math.min(1, p.raised / p.budget) : 0
  const proj = Math.min(1, p.projected)
  const remaining = Math.max(0, p.budget - p.raised)
  const pos = (v: number) => `calc(${v * 100}% )`
  return (
    <section aria-label="Progresso da arrecadação" className="relative overflow-hidden rounded-xl text-white shadow-lg
      bg-[linear-gradient(135deg,#0B1E45_0%,#10306F_55%,#1A47A8_100%)] dark:bg-[linear-gradient(135deg,#0B1A3C_0%,#0F2A62_60%,#163C8E_100%)]
      ring-1 ring-white/10">
      {/* curvas de nível discretas: mar e rota */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.10]" preserveAspectRatio="none" viewBox="0 0 800 300" aria-hidden>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path key={i} d={`M -20 ${210 + i * 18} C 160 ${150 + i * 18}, 320 ${260 + i * 18}, 520 ${190 + i * 18} S 760 ${150 + i * 18}, 840 ${190 + i * 18}`}
            fill="none" stroke="#fff" strokeWidth="1" />
        ))}
      </svg>
      <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-[#F2B705]/20 blur-3xl" aria-hidden />

      <div className="relative grid lg:grid-cols-[1fr_220px]">
        {/* parte principal */}
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[15px] text-white/75">{p.greeting}</p>
            <span className="inline-flex items-center gap-2 h-7 px-3 rounded-full bg-white/10 ring-1 ring-inset ring-white/15 text-[12px] font-medium">
              <span className="size-1.5 rounded-full bg-[#F2B705] animate-pulse" aria-hidden />
              {p.raised > 0 ? 'Arrecadação em andamento' : 'Arrecadação ainda não iniciada'}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap items-end gap-x-10 gap-y-4">
            <div>
              <p className="text-[13px] text-white/60">Saldo da turma</p>
              <p className="font-display font-bold tracking-[-0.035em] text-[52px] sm:text-[64px] leading-[0.95] mt-2">
                <AnimatedNumber value={p.raised} format={moneyShort} />
              </p>
            </div>
            <dl className="flex gap-8 pb-1.5 text-sm">
              <div><dt className="text-white/55 text-[13px]">Faltam</dt><dd className="num font-semibold text-lg mt-0.5">{moneyShort(remaining)}</dd></div>
              <div><dt className="text-white/55 text-[13px]">Meta</dt><dd className="num font-semibold text-lg mt-0.5">{moneyShort(p.budget)}</dd></div>
            </dl>
          </div>

          {/* trilha da viagem */}
          <div className="mt-9">
            <div className="flex justify-between items-end text-[13px]">
              <div><p className="text-white/50 text-[11px]">Saída</p><p className="font-semibold">{p.origin}</p></div>
              <div className="text-right"><p className="text-white/50 text-[11px]">Chegada</p><p className="font-semibold">{p.destinationCity}</p></div>
            </div>
            <div className="relative mt-3 h-6" role="img"
              aria-label={`${percent(real)} da meta arrecadado. O cenário ilustrativo chega a ${percent(proj)} em ${p.months} meses.`}>
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[3px] rounded-full bg-[repeating-linear-gradient(90deg,rgba(255,255,255,.28)_0_6px,transparent_6px_12px)]" />
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-[3px] rounded-full bg-[#F2B705]/50" style={{ width: pos(proj) }} />
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-[5px] rounded-full bg-[#F2B705] shadow-[0_0_14px_rgba(242,183,5,.7)] transition-[width] duration-1000 ease-out" style={{ width: pos(real) }} />
              <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex" style={{ left: pos(proj) }}>
                <Tooltip content={`Projeção: ${percent(proj)} da meta em ${p.months} meses, no cenário ilustrativo`}>
                  <button type="button" aria-label="Ver projeção" className="size-4 rounded-full border-2 border-[#F2B705] bg-[#12347A] transition-transform hover:scale-125" />
                </Tooltip>
              </span>
              <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-5 rounded-full bg-[#F2B705] ring-4 ring-[#F2B705]/25 transition-[left] duration-1000 ease-out" style={{ left: pos(real) }} aria-hidden />
              <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 size-3 rounded-full bg-white" aria-hidden />
            </div>
            <div className="flex flex-wrap justify-between gap-2 mt-3 text-[12px] text-white/60">
              <span className="num"><b className="text-white font-semibold">{percent(real)}</b> arrecadado</span>
              <span className="num">Projeção em {p.months} meses: <b className="text-[#F2B705] font-semibold">{percent(proj)}</b></span>
            </div>
          </div>
        </div>

        {/* canhoto do bilhete */}
        <div className="relative border-t lg:border-t-0 lg:border-l border-dashed border-white/20 p-6 sm:px-8 lg:px-6 lg:py-8">
          <span className="hidden lg:block absolute -top-3 -left-3 size-6 rounded-full bg-bg" aria-hidden />
          <span className="hidden lg:block absolute -bottom-3 -left-3 size-6 rounded-full bg-bg" aria-hidden />
          <p className="font-display font-bold text-lg tracking-[-0.01em]">{p.destination}</p>
          <p className="text-[12px] text-white/55">Destino provisório</p>
          <dl className="grid grid-cols-3 lg:grid-cols-1 gap-4 mt-5 text-sm">
            <div><dt className="text-white/50 text-[11px]">Embarque</dt><dd className="num font-semibold mt-0.5">{p.year}</dd></div>
            <div><dt className="text-white/50 text-[11px]">Duração</dt><dd className="font-semibold mt-0.5">{p.days} dias, {p.nights} noites</dd></div>
            <div><dt className="text-white/50 text-[11px]">Turma</dt><dd className="num font-semibold mt-0.5">{p.enrolled} de {p.expected} alunos</dd></div>
          </dl>
        </div>
      </div>
    </section>
  )
}
