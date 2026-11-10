import { createContext, useContext, type ReactNode } from 'react'
import { DEFAULT_SETTINGS } from '@/config/defaults'
import type { ProjectSettings } from '@/types/domain'

/**
 * Etapa 1: parâmetros somente leitura vindos de config/defaults.ts.
 * Etapa 2: passa a ler/gravar na tabela `settings` do banco, com auditoria.
 */
const Ctx = createContext<ProjectSettings>(DEFAULT_SETTINGS)
export const SettingsProvider = ({ children }: { children: ReactNode }) => (
  <Ctx.Provider value={DEFAULT_SETTINGS}>{children}</Ctx.Provider>
)
export const useSettings = () => useContext(Ctx)
