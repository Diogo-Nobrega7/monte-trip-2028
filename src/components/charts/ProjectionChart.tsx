import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { projectDeposits } from '@/lib/finance'
import { moneyShort } from '@/lib/format'
import type { Cents } from '@/types/domain'
import { ChartTooltip } from './ChartTooltip'
import { axisTick, c, compactBRL } from './theme'

/**
 * Saldo projetado do grupo, empilhando o que foi depositado e o que rendeu, contra a meta.
 * Usa projectDeposits (testado) — nenhum cálculo novo aqui.
 */
export function ProjectionChart({ monthly, months, annualRate, students, budget, height = 280 }: {
  monthly: Cents; months: number; annualRate: number; students: number; budget: Cents; height?: number
}) {
  const data = projectDeposits(monthly, months, annualRate).map((p) => ({
    mes: p.month,
    depositado: p.deposited * students,
    rendimento: p.yield * students,
    saldo: p.balance * students,
  }))
  const max = Math.max(budget, data.at(-1)?.saldo ?? 0)
  return (
    <div style={{ height }} className="-ml-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="gDep" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c('accent')} stopOpacity={0.28} />
              <stop offset="100%" stopColor={c('accent')} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gRend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c('gold')} stopOpacity={0.55} />
              <stop offset="100%" stopColor={c('gold')} stopOpacity={0.15} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={c('line')} strokeDasharray="0" />
          <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={axisTick} tickMargin={10}
            tickFormatter={(m) => `${m}º`} minTickGap={16} />
          <YAxis tickLine={false} axisLine={false} width={76} tick={axisTick} tickFormatter={compactBRL}
            domain={[0, Math.ceil((max * 1.08) / 500000) * 500000]} tickCount={5} />
          <Tooltip cursor={{ stroke: c('faint', 0.5), strokeDasharray: '3 3' }}
            content={<ChartTooltip labels={{ depositado: 'Depositado', rendimento: 'Rendimento' }}
              titleFor={(m) => `${m}º mês`} totalKey="saldo" totalLabel="Saldo projetado" />} />
          <ReferenceLine y={budget} stroke={c('ink', 0.45)} strokeDasharray="5 5" ifOverflow="extendDomain"
            label={{ value: `Meta ${moneyShort(budget)}`, position: 'insideTopRight', fill: c('muted'), fontSize: 12, dy: -14 }} />
          <Area type="monotone" stackId="1" dataKey="depositado" stroke={c('accent')} strokeWidth={2} fill="url(#gDep)"
            animationDuration={700} animationEasing="ease-out" activeDot={{ r: 4, strokeWidth: 0, fill: c('accent') }} />
          <Area type="monotone" stackId="1" dataKey="rendimento" stroke={c('gold')} strokeWidth={2} fill="url(#gRend)"
            animationDuration={700} animationEasing="ease-out" activeDot={{ r: 4, strokeWidth: 0, fill: c('gold') }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
