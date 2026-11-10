import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/**
 * Cliente do Supabase. Fica null quando as variáveis não foram configuradas:
 * o site continua abrindo, mas sem dados e sem login (modo demonstração).
 * Só a publishable key vai para o navegador; a permissão real é feita pelo RLS do banco.
 */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null
export const connected = supabase !== null
