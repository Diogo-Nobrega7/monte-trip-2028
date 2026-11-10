/** Cores dos gráficos lidas dos tokens CSS — mudam junto com o tema. */
export const c = (token: string, alpha = 1) => `rgb(var(--${token}) / ${alpha})`
export const axisTick = { fill: c('faint'), fontSize: 12 }
export const compactBRL = (cents: number) => {
  const r = cents / 100
  if (Math.abs(r) >= 1000) return `R$ ${(r / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`
  return `R$ ${r.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}
