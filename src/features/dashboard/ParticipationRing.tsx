/** Anel de adesão: inscritos sobre vagas estimadas, com legenda por situação. */
export function ParticipationRing({ enrolled, expected, ontime, late }: { enrolled: number; expected: number; ontime: number; late: number }) {
  const r = 42, C = 2 * Math.PI * r
  const k = expected > 0 ? Math.min(1, enrolled / expected) : 0
  return (
    <div className="flex items-center gap-6">
      <div className="relative size-[112px] shrink-0">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(var(--sunken))" strokeWidth="9" />
          {k > 0 && <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(var(--accent))" strokeWidth="9" strokeLinecap="round"
            strokeDasharray={`${C * k} ${C}`} className="transition-[stroke-dasharray] duration-1000 ease-out" />}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div><p className="num font-display text-2xl font-bold leading-none">{enrolled}</p><p className="text-[11px] text-faint mt-1">de {expected}</p></div>
        </div>
      </div>
      <dl className="flex-1 space-y-2.5 text-sm">
        <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-accent" /><dt className="flex-1 text-muted">Inscritos</dt><dd className="num font-medium">{enrolled}</dd></div>
        <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-ok" /><dt className="flex-1 text-muted">Em dia</dt><dd className="num font-medium">{ontime}</dd></div>
        <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-bad" /><dt className="flex-1 text-muted">Em atraso</dt><dd className="num font-medium">{late}</dd></div>
      </dl>
    </div>
  )
}
