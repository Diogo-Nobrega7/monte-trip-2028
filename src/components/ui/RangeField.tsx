import { useId } from 'react'

/**
 * Controle deslizante + campo numérico sincronizados.
 * O campo aceita digitação livre e limita ao intervalo ao sair.
 */
export function RangeField({ label, value, min, max, step, onChange, format, unit }: {
  label: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void; format: (v: number) => string; unit?: string
}) {
  const id = useId()
  const fill = ((value - min) / (max - min)) * 100
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step))
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-[13px] text-muted">{label}</label>
        <div className="flex items-center gap-1 rounded-sm bg-sunken px-2 h-7 focus-within:ring-2 focus-within:ring-accent">
          <input type="number" inputMode="decimal" aria-label={`${label} (valor)`} min={min} max={max} step={step} value={value}
            onChange={(e) => e.target.value !== '' && onChange(Number(e.target.value))}
            onBlur={(e) => onChange(clamp(Number(e.target.value) || min))}
            className="num w-16 bg-transparent text-right text-sm font-semibold text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
          {unit && <span className="text-xs text-faint">{unit}</span>}
        </div>
      </div>
      <input id={id} type="range" className="range mt-2" min={min} max={max} step={step} value={value}
        aria-valuetext={format(value)} onChange={(e) => onChange(Number(e.target.value))}
        style={{ ['--fill' as string]: `${Math.max(0, Math.min(100, fill))}%` }} />
      <div className="flex justify-between text-[11px] text-faint num"><span>{format(min)}</span><span>{format(max)}</span></div>
    </div>
  )
}
