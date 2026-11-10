import type { Cents } from '@/types/domain'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 })

export const money = (c: Cents) => brl.format(c / 100)
export const moneyShort = (c: Cents) => brl0.format(c / 100)
export const percent = (x: number) => pct.format(x)
