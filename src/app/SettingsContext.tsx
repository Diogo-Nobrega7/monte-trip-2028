import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { DEFAULT_SETTINGS } from '@/config/defaults'
import { connected } from '@/data/supabase'
import { getCurrentSettings } from '@/data/settings'
import type { ProjectSettings } from '@/types/domain'

/**
 * Configuração vigente do projeto.
 * - Com banco: lê configuracao_vigente() (versão mais recente, aprovada quando exigido).
 * - Sem banco (modo demonstração): usa o cenário ilustrativo de config/defaults.ts.
 * Nunca mistura os dois: se o banco falhar, a tela avisa em vez de mostrar números de exemplo como reais.
 */
interface SettingsState {
  settings: ProjectSettings
  /** 'banco' = valores oficiais; 'exemplo' = cenário ilustrativo (demonstração ou ainda carregando). */
  source: 'banco' | 'exemplo'
  version: number | null
  loading: boolean
  error: string | null
  reload: () => void
}

const Ctx = createContext<SettingsState>({
  settings: DEFAULT_SETTINGS, source: 'exemplo', version: null, loading: false, error: null, reload: () => {},
})

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<SettingsState, 'reload'>>({
    settings: DEFAULT_SETTINGS, source: 'exemplo', version: null, loading: connected, error: null,
  })
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!connected) return
    let alive = true
    setState((s) => ({ ...s, loading: true }))
    getCurrentSettings().then(
      (r) => alive && setState({ settings: r.settings, source: 'banco', version: r.version, loading: false, error: null }),
      (e: Error) => alive && setState((s) => ({ ...s, loading: false, error: e.message })),
    )
    return () => { alive = false }
  }, [tick])

  return <Ctx.Provider value={{ ...state, reload }}>{children}</Ctx.Provider>
}

/** Parâmetros vigentes (atalho usado pela maioria das telas). */
export const useSettings = () => useContext(Ctx).settings
/** Estado completo: origem, versão, carregamento e recarregar após salvar. */
export const useSettingsState = () => useContext(Ctx)
