import { useState, type ReactNode } from 'react'
import { Menu } from 'lucide-react'
import { routeById, type RouteId } from '@/app/routes'
import type { ThemePref } from '@/hooks/useTheme'
import { Sidebar } from './Sidebar'
import { BrandMark } from './Brand'
import { MobileTabBar } from './MobileTabBar'

export function AppShell({ route, onNavigate, theme, onTheme, children }: {
  route: RouteId; onNavigate: (id: RouteId) => void; theme: ThemePref; onTheme: (t: ThemePref) => void; children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-full">
      <Sidebar route={route} onNavigate={onNavigate} theme={theme} onTheme={onTheme} open={open} onClose={() => setOpen(false)} />

      <header className="lg:hidden sticky top-[env(safe-area-inset-top,0px)] z-20 bg-bg/80 backdrop-blur-xl border-b border-line/60">
        <div className="flex items-center gap-3 h-14 px-4">
          <BrandMark size={28} />
          <span className="font-display font-bold text-[16px] tracking-[-0.01em] flex-1">{routeById(route).label}</span>
          <button onClick={() => setOpen(true)} className="p-2 -mr-2 rounded-md text-muted hover:text-ink" aria-label="Abrir menu"><Menu size={20} /></button>
        </div>
      </header>
      {/* cobre a área da barra de status quando a página rola no celular */}
      <div className="lg:hidden fixed inset-x-0 top-0 z-20 h-[env(safe-area-inset-top,0px)] bg-bg" aria-hidden />

      <main className="lg:pl-[260px]">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-12 pt-7 lg:pt-12 pb-28 lg:pb-16">{children}</div>
      </main>

      <MobileTabBar route={route} onNavigate={onNavigate} onMore={() => setOpen(true)} />
    </div>
  )
}
