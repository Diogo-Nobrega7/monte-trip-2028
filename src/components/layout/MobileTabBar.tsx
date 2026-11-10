import { LayoutDashboard, CalendarClock, Calculator, Users, Menu } from 'lucide-react'
import type { RouteId } from '@/app/routes'
import { cx } from '@/components/ui'

const TABS: { id: RouteId; label: string; icon: typeof Menu }[] = [
  { id: 'painel', label: 'Painel', icon: LayoutDashboard },
  { id: 'mensalidades', label: 'Pagamentos', icon: CalendarClock },
  { id: 'alunos', label: 'Alunos', icon: Users },
  { id: 'simulador', label: 'Simular', icon: Calculator },
]

/** Barra inferior no celular: os destinos mais usados ao alcance do polegar + "Mais" abre o menu. */
export function MobileTabBar({ route, onNavigate, onMore }: { route: RouteId; onNavigate: (id: RouteId) => void; onMore: () => void }) {
  const inTabs = TABS.some((t) => t.id === route)
  return (
    <nav aria-label="Atalhos" className="lg:hidden fixed inset-x-0 bottom-0 z-30 bg-surface/85 backdrop-blur-xl border-t border-line pb-[env(safe-area-inset-bottom,0px)]">
      <ul className="grid grid-cols-5 h-16">
        {TABS.map((t) => {
          const active = t.id === route
          return (
            <li key={t.id}>
              <a href={`#${t.id}`} onClick={(e) => { e.preventDefault(); onNavigate(t.id) }} aria-current={active ? 'page' : undefined}
                className={cx('h-full flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors', active ? 'text-accent' : 'text-faint')}>
                <span className={cx('grid place-items-center h-7 w-12 rounded-full transition-colors', active && 'bg-accent/10')}>
                  <t.icon size={19} strokeWidth={active ? 2.3 : 1.9} aria-hidden />
                </span>
                {t.label}
              </a>
            </li>
          )
        })}
        <li>
          <button onClick={onMore} className={cx('w-full h-full flex flex-col items-center justify-center gap-1 text-[11px] font-medium', !inTabs ? 'text-accent' : 'text-faint')}>
            <span className={cx('grid place-items-center h-7 w-12 rounded-full', !inTabs && 'bg-accent/10')}><Menu size={19} aria-hidden /></span>
            Mais
          </button>
        </li>
      </ul>
    </nav>
  )
}
