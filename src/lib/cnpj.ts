/** CNPJ: só dígitos, 14 no total, com dígitos verificadores válidos. Mesma regra de cnpj_valido() no banco. */
export const cnpjDigits = (s: string) => s.replace(/\D/g, '')

export function isValidCnpj(input: string): boolean {
  const c = cnpjDigits(input)
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false
  const d = [...c].map(Number)
  const check = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const r = weights.reduce((s, w, i) => s + w * d[i], 0) % 11
    return r < 2 ? 0 : 11 - r
  }
  return check(12) === d[12] && check(13) === d[13]
}

/** 11222333000181 → 11.222.333/0001-81 */
export function formatCnpj(input: string): string {
  const c = cnpjDigits(input)
  if (c.length !== 14) return input
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`
}
