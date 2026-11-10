import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type Role = 'admin' | 'supervisor' | 'responsavel' | 'aluno'

interface AuthState {
  ready: boolean
  session: Session | null
  name: string | null
  role: Role | null
  isAdmin: boolean
  canReadAll: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

/** Sessão do usuário e papel vindo da tabela `profiles`. A tela só esconde botões; quem bloqueia é o RLS. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!supabase)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<{ name: string; role: Role } | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (!data.session) setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase) return
    if (!session) { setProfile(null); return }
    let alive = true
    supabase.from('profiles').select('nome,papel').eq('id', session.user.id).maybeSingle().then(({ data }) => {
      if (!alive) return
      setProfile(data ? { name: data.nome, role: data.papel } : null)
      setReady(true)
    })
    return () => { alive = false }
  }, [session])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Banco não configurado')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw new Error(/invalid/i.test(error.message) ? 'E-mail ou senha incorretos.' : error.message)
  }, [])

  const signOut = useCallback(async () => { await supabase?.auth.signOut() }, [])

  const role = profile?.role ?? null
  return (
    <Ctx.Provider value={{
      ready, session, name: profile?.name ?? null, role,
      isAdmin: role === 'admin', canReadAll: role === 'admin' || role === 'supervisor',
      signIn, signOut,
    }}>{children}</Ctx.Provider>
  )
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth fora do AuthProvider')
  return v
}
