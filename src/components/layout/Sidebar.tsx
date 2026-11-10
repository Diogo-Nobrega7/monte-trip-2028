import { X } from 'lucide-react'
import { ROUTES, type RouteId } from '@/app/routes'
import { useSettings } from '@/app/SettingsContext'
import type { ThemePref } from '@/hooks/useTheme'
import { cx } from '@/components/ui'
import { Brand } from './Brand'
import { UserMenu } from './UserMenu'

const MENU = ROUTES.filter((r) => !r.hidden)
const groups = [...new Set(MENU.map((r) => r.group))]

export function Sidebar({ route, onNavigate, theme, onTheme, open, onClose }: {
  route: RouteId; onNavigate: (id: RouteId) => void; theme: ThemePref; onTheme: (t: ThemePref) => void
  open: boolean; onClose: () => void
}) {
  const s = useSettings()
  return (
    <>
      <div onClick={onClose} aria-hidden
        className={cx('fixed inset-0 z-40 bg-[#060C1B]/55 backdrop-blur-[2px] lg:hidden transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none')} />
      <aside aria-label="Navegação principal"
        className={cx(
          'fixed z-50 inset-y-0 left-0 w-[280px] lg:w-[260px] flex flex-col text-white',
          'bg-[#0A1A3D] dark:bg-[#071129] lg:border-r border-white/[0.06]',
          'pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]',
          'transition-transform duration-300 ease-out lg:translate-x-0 shadow-lg lg:shadow-none',
          open ? 'translate-x-0' : '-translate-x-full',
        )}>
        {/* brilho sutil no topo */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(80%_100%_at_20%_0%,rgba(47,107,255,0.22),transparent)]" aria-hidden />
        <div className="relative flex items-center justify-between px-5 h-[72px]">
          <Brand />
          <button onClick={onClose} className="lg:hidden p-2 -mr-2 rounded-md text-white/60 hover:text-white" aria-label="Fechar menu"><X size={18} /></button>
        </div>

        <button onClick={() => { onNavigate('viagem'); onClose() }}
          className="relative mx-4 mb-3 rounded-md bg-white/[0.05] ring-1 ring-inset ring-white/[0.06] px-3.5 py-3 text-left transition-colors hover:bg-white/[0.08]">
          <span className="flex items-center justify-between text-[12px] text-white/50">
            {s.provisional ? 'Destino provisório' : 'Destino'} <span className="size-1.5 rounded-full bg-[#F2B705]" aria-hidden />
          </span>
          <span className="block text-sm font-medium mt-1">{s.destination}</span>
          <span className="block text-[12px] text-white/50 mt-0.5">{s.destinationCity}, {s.days} dias e {s.nights} noites</span>
        </button>

        <nav className="relative flex-1 overflow-y-auto px-3 py-2">
          {groups.map((g) => (
            <div key={g} className="mb-5">
              <p className="px-3 mb-1.5 text-[11px] font-medium text-white/35">{g}</p>
              <ul className="space-y-0.5">
                {MENU.filter((r) => r.group === g).map((r) => {
                  const active = r.id === route
                  return (
                    <li key={r.id}>
                      <a href={`#${r.id}`} aria-current={active ? 'page' : undefined}
                        onClick={(e) => { e.preventDefault(); onNavigate(r.id); onClose() }}
                        className={cx('group relative flex items-center gap-3 h-10 lg:h-9 px-3 rounded-md text-[14px] transition-all duration-150',
                          active ? 'bg-white/[0.09] text-white font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]' : 'text-white/60 hover:text-white hover:bg-white/[0.04]')}>
                        <r.icon size={17} strokeWidth={active ? 2.2 : 1.8} aria-hidden
                          className={cx('transition-colors', active ? 'text-[#F2B705]' : 'text-white/45 group-hover:text-white/80')} />
                        {r.label}
                        {active && <span className="ml-auto size-1.5 rounded-full bg-[#F2B705]" aria-hidden />}
                      </a>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="relative border-t border-white/[0.07] p-3">
          <UserMenu theme={theme} onTheme={onTheme} />
        </div>
      </aside>
    </>
  )
}
