import { ChevronsUpDown, LogIn, LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { Dropdown } from '@/components/ui'
import { useAuth } from '@/data/auth'
import { connected } from '@/data/supabase'
import type { ThemePref } from '@/hooks/useTheme'

const opts = [
  { id: 'light', label: 'Tema claro', icon: Sun },
  { id: 'dark', label: 'Tema escuro', icon: Moon },
  { id: 'system', label: 'Seguir o sistema', icon: Monitor },
]

const ROLE_LABEL: Record<string, string> = { admin: 'Administrador', supervisor: 'Supervisão', responsavel: 'Responsável', aluno: 'Aluno' }

export function UserMenu({ theme, onTheme }: { theme: ThemePref; onTheme: (t: ThemePref) => void }) {
  const { session, name, role, signOut } = useAuth()
  const display = session ? (name ?? session.user.email ?? 'Conta') : 'Visitante'
  const sub = !connected ? 'Modo demonstração'
    : session ? (role ? ROLE_LABEL[role] : 'Sem permissão de edição')
    : 'Só leitura dos totais'

  const items = [
    ...opts.map((o) => ({ ...o, selected: o.id === theme })),
    ...(connected ? [session
      ? { id: 'sair', label: 'Sair', icon: LogOut }
      : { id: 'entrar', label: 'Entrar como administrador', icon: LogIn }] : []),
  ]

  return (
    <Dropdown label="Conta e aparência" placement="top" items={items}
      onSelect={(id) => {
        if (id === 'sair') void signOut()
        else if (id === 'entrar') window.location.hash = 'entrar'
        else onTheme(id as ThemePref)
      }}
      trigger={({ open, toggle, id }) => (
        <button onClick={toggle} aria-expanded={open} aria-controls={id} aria-haspopup="menu"
          className="w-full flex items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-white/[0.06]">
          <span className="grid place-items-center size-8 rounded-full bg-gradient-to-br from-[#F2B705] to-[#E39A00] text-[#0B1E45] text-sm font-bold">
            {display.charAt(0).toUpperCase()}
          </span>
          <span className="flex-1 min-w-0 leading-tight">
            <span className="block text-sm font-medium text-white truncate">{display}</span>
            <span className="block text-[12px] text-white/50 truncate">{sub}</span>
          </span>
          <ChevronsUpDown size={15} className="text-white/40" aria-hidden />
        </button>
      )} />
  )
}
