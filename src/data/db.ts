import { supabase } from './supabase'

/** Cliente do banco; lança erro claro no modo demonstração. */
export const db = () => {
  if (!supabase) throw new Error('Banco não configurado (modo demonstração).')
  return supabase
}

/** Mensagens do banco em português simples. As exceções das nossas funções já vêm em português. */
export function friendly(e: { message: string; code?: string; details?: string | null }): Error {
  const m = e.message ?? ''
  if (e.code === '42501' || /row-level security|permission denied/i.test(m)) {
    return new Error(/Só |Sem permissão/.test(m) ? m : 'Sem permissão para esta ação. Entre com a conta de administrador.')
  }
  if (e.code === '23505') return new Error(/estorno_de/.test(m) ? 'Esse lançamento já foi estornado.' : /cnpj/.test(m) ? 'Já existe uma agência com esse CNPJ.' : 'Esse lançamento já foi registrado (envio repetido).')
  if (e.code === '23514') return new Error('Algum dado está fora do permitido. Confira os campos e tente de novo.')
  if (e.code === '23503') return new Error('Registro relacionado não encontrado. Atualize a página e tente de novo.')
  if (/Failed to fetch|NetworkError|network/i.test(m)) return new Error('Sem conexão com o banco. Verifique a internet e tente de novo.')
  return new Error(m)
}

/** Lê todas as linhas de uma consulta, de 1000 em 1000 (limite padrão do Supabase). */
export async function selectAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999)
    if (error) throw friendly(error)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) return out
  }
}
