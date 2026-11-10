/** Marca: um "M" desenhado como rota com o sol no ponto de chegada. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id="bm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2F6BFF" /><stop offset="1" stopColor="#173A8F" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#bm)" />
      <path d="M8 23 V11 l8 8 l8 -8 V23" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="9" r="3.4" fill="#F2B705" />
    </svg>
  )
}

export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <BrandMark />
      <div className="leading-tight">
        <p className="font-display font-bold text-white text-[15px] tracking-[-0.01em]">Monte Trip <span className="text-white/50 font-medium">2028</span></p>
        <p className="text-[12px] text-white/50">Gestão da viagem de formatura</p>
      </div>
    </div>
  )
}
