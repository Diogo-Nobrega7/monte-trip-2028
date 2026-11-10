import {
  LayoutDashboard, Users, CalendarClock, HandCoins, Receipt, Calculator,
  Plane, Building2, FileText, Settings, LogIn, FileBarChart, type LucideIcon,
} from 'lucide-react'

/** Rotas por hash simples (#alunos). Nomes em ASCII, sem barras. */
export type RouteId =
  | 'painel' | 'alunos' | 'mensalidades' | 'arrecadacoes' | 'despesas'
  | 'relatorios' | 'simulador' | 'viagem' | 'agencias' | 'documentos' | 'configuracoes' | 'entrar'

export interface RouteDef {
  id: RouteId
  label: string
  icon: LucideIcon
  group: 'Visão geral' | 'Financeiro' | 'Organização' | 'Administração'
  description: string
  /** Fora do menu lateral (ex.: tela de login). */
  hidden?: boolean
}

export const ROUTES: RouteDef[] = [
  { id: 'painel', label: 'Painel', icon: LayoutDashboard, group: 'Visão geral', description: 'Situação financeira e andamento do projeto.' },
  { id: 'mensalidades', label: 'Mensalidades', icon: CalendarClock, group: 'Financeiro', description: 'Parcelas, pagamentos, atrasos e estornos de cada aluno.' },
  { id: 'arrecadacoes', label: 'Arrecadações', icon: HandCoins, group: 'Financeiro', description: 'Rifas, vendas, eventos, doações e patrocínios.' },
  { id: 'despesas', label: 'Despesas', icon: Receipt, group: 'Financeiro', description: 'Saídas de caixa com categoria, justificativa e comprovante.' },
  { id: 'relatorios', label: 'Prestação de contas', icon: FileBarChart, group: 'Financeiro', description: 'Entradas, saídas, saldo por período e exportação.' },
  { id: 'simulador', label: 'Simulador', icon: Calculator, group: 'Financeiro', description: 'Projete saldo, rendimento e déficit em diferentes cenários.' },
  { id: 'alunos', label: 'Alunos', icon: Users, group: 'Organização', description: 'Participantes, adesões e situação de cada aluno.' },
  { id: 'viagem', label: 'Viagem', icon: Plane, group: 'Organização', description: 'Destino, datas, transporte, hospedagem e serviços.' },
  { id: 'agencias', label: 'Agências', icon: Building2, group: 'Organização', description: 'Contatos, propostas e comparação de condições.' },
  { id: 'documentos', label: 'Documentos', icon: FileText, group: 'Organização', description: 'Regulamento, autorizações, contratos e recibos.' },
  { id: 'configuracoes', label: 'Configurações', icon: Settings, group: 'Administração', description: 'Parâmetros financeiros e regras do projeto.' },
  { id: 'entrar', label: 'Entrar', icon: LogIn, group: 'Administração', description: 'Acesso da administração.', hidden: true },
]

export const routeById = (id: RouteId) => ROUTES.find((r) => r.id === id)!
export const isRouteId = (s: string): s is RouteId => ROUTES.some((r) => r.id === s)
