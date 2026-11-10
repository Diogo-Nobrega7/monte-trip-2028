import { useEffect, type ReactNode } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { SettingsProvider } from '@/app/SettingsContext'
import { ToastProvider } from '@/components/ui'
import { routeById, type RouteId } from '@/app/routes'
import { useHashRoute } from '@/hooks/useHashRoute'
import { useTheme } from '@/hooks/useTheme'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { StudentsPage } from '@/features/students/StudentsPage'
import { InstallmentsPage } from '@/features/installments/InstallmentsPage'
import { FundraisingPage } from '@/features/fundraising/FundraisingPage'
import { ExpensesPage } from '@/features/expenses/ExpensesPage'
import { SimulatorPage } from '@/features/simulator/SimulatorPage'
import { TripPage } from '@/features/trip/TripPage'
import { AgenciesPage } from '@/features/agencies/AgenciesPage'
import { DocumentsPage } from '@/features/documents/DocumentsPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { AuthProvider } from '@/data/auth'

export default function App() {
  const { route, go } = useHashRoute()
  const { pref, setPref } = useTheme()

  useEffect(() => {
    document.title = `${routeById(route).label} | Monte Trip 2028`
    window.scrollTo({ top: 0 })
  }, [route])

  const pages: Record<RouteId, ReactNode> = {
    painel: <DashboardPage onNavigate={go} />,
    alunos: <StudentsPage />,
    mensalidades: <InstallmentsPage />,
    arrecadacoes: <FundraisingPage />,
    despesas: <ExpensesPage />,
    relatorios: <ReportsPage />,
    simulador: <SimulatorPage />,
    viagem: <TripPage />,
    agencias: <AgenciesPage />,
    documentos: <DocumentsPage />,
    configuracoes: <SettingsPage />,
    entrar: <LoginPage onNavigate={go} />,
  }

  return (
    <AuthProvider>
    <SettingsProvider>
      <ToastProvider>
        <AppShell route={route} onNavigate={go} theme={pref} onTheme={setPref}>
          <div key={route} className="page-in">{pages[route]}</div>
        </AppShell>
      </ToastProvider>
    </SettingsProvider>
    </AuthProvider>
  )
}
