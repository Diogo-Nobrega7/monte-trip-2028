# CLAUDE.md — Monte Trip 2028

Contexto para qualquer sessão de desenvolvimento. Ler antes de alterar código.

## Projeto
Plataforma de gestão da viagem de formatura do 3º ano do Colégio Monte (Natal/RN), prevista para 2028.
Idealizador e administrador: Davi. Supervisão: professor(a) da escola.
Cenário inicial (provisório, editável): Beach Park, Aquiraz/CE; 4 dias/3 noites; ~20 alunos; saída de Natal.
Briefings: docs/BRIEFING.md (sistema) e docs/BRIEFING-REDESIGN.md (visual).
Contexto, riscos e pendências das conversas iniciais: docs/CONTEXTO.md.

## Regras inegociáveis
- Dinheiro sempre em centavos (inteiros). Nunca float para valores armazenados.
- Nada de dados fictícios apresentados como reais. Sem lançamento = zero ou estado vazio.
- Projeções sempre rotuladas como ilustrativas/hipotéticas.
- Toda regra de negócio (taxa, multa, devolução, vencimento) vem de configurações, nunca fixa no código.
- Dados de alunos são de menores: acesso mínimo, nunca públicos, consentimento dos responsáveis.
- localStorage só para preferência visual (tema). Dados do sistema vão para o banco.
- Movimentações financeiras são imutáveis: correção = estorno + novo lançamento.

## Stack
- Vite 5 + React 18 + TypeScript (strict) + Tailwind 3
- Recharts (gráficos), lucide-react (ícones)
- Vitest (testes), playwright-core (teste de fumaça)
- Planejado: Supabase (Postgres, Auth, RLS, Storage) — ver docs/ARQUITETURA.md

## Comandos
```
npm install
npm run dev          # desenvolvimento
npm test             # testes unitários (cálculos financeiros)
npm run typecheck
npm run build        # gera dist/index.html (arquivo único)
npx playwright-core install chromium   # uma vez, para o teste de fumaça
npx vite preview --port 4173 &
node scripts/smoke.mjs                 # opcional: CHROME=<caminho> para outro Chromium
```
Variáveis: copiar `.env.example` para `.env.local` (Supabase URL + publishable key).

Design system: docs/DESIGN.md (tokens, componentes, regras visuais).

## Estrutura
```
src/
  app/          rotas (routes.ts) e contexto de configurações
  components/
    layout/     AppShell, Sidebar, UserMenu, MobileTabBar, Brand
    ui/         Button, Card, Badge, Tooltip, Modal, Dropdown, Field, RangeField,
                Segmented, Toolbar, DataTable, Stat, AnimatedNumber, Toast, Skeleton…
    charts/     ProjectionChart, ChartTooltip, ChartLegend, tema dos gráficos
    patterns/   ListPage (cabeçalho + indicadores + busca/filtro + tabela + modal), StatRow
  config/       defaults.ts — cenário inicial ilustrativo
  features/     uma pasta por módulo (dashboard, students, installments,
                fundraising, expenses, simulator, trip, agencies, documents, settings)
  hooks/        useHashRoute, useTheme
  lib/          finance.ts (+ testes), format.ts
  types/        domain.ts
```

## Convenções
- Rotas por hash simples: `#painel`, `#alunos`… (sem barras ou query string).
- Cores só via tokens CSS (src/index.css) → classes `bg-surface`, `text-muted`, `bg-accent`, `bg-gold`…
- Nada de componente visual novo sem antes verificar se já existe em components/ui.
- Tema: claro/escuro/sistema via `data-theme` no `<html>`.
- Novo módulo: criar `features/<modulo>/<Modulo>Page.tsx`, registrar em `app/routes.ts` e em `App.tsx`.
- Cálculos financeiros apenas em `lib/` como funções puras, sempre com teste.
- Textos da interface em português, voz ativa, sem jargão técnico.

## Decisões
- Vite SPA em vez de Next.js: não há necessidade de SSR; deploy estático; o backend é o Supabase.
- Supabase: Postgres relacional + autenticação + RLS resolvem multiusuário e permissões sem servidor próprio.
- Juros: taxa mensal equivalente (1+a)^(1/12)−1, depósitos postecipados. Validado contra a tabela do briefing.

## Estado atual
Etapas 1 e 1.5 concluídas. Etapa 2 parcial (2026-11-10): Supabase (migração, RLS, login), cadastro de alunos,
registro e estorno de pagamentos, resumo público no Painel, deploy no GitHub Pages. Detalhes: docs/PROGRESSO.md.
Publicação e configuração do Supabase: docs/PUBLICAR.md.
Sem `.env.local` o site roda em modo demonstração (`src/data/supabase.ts` → cliente null).

## Publicação
- No ar: https://diogo-nobrega7.github.io/monte-trip-2028/ (repo Diogo-Nobrega7/monte-trip-2028).
  Supabase: projeto `qhfwefqtgcuulukefvtk`, região São Paulo. Admin: Davi.
- GitHub Pages via `.github/workflows/deploy.yml` (push na main). Variáveis do repo: `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Site público mostra só `resumo_publico()` (totais). Alunos e pagamentos: só admin/supervisor (RLS).
- Cadastro aberto desligado no Supabase; contas criadas à mão e papel em `profiles`.

## Origem e continuidade
Etapas 1 e 1.5 feitas no claude.ai (chat). Versão publicada lá como página estática de demonstração.
A partir daqui o desenvolvimento segue no Claude Code, neste repositório.

## Próxima sessão: fechar a etapa 2
1. Com o Supabase criado: testar login, cadastro, pagamento, estorno e bloqueio de visitante no site real.
2. Teste de RLS (anon não lê students/payments; supervisor não grava; ninguém faz update/delete em payments).
3. Configurações editáveis com histórico (tabela `settings`).
4. Ledger separado (hoje `payments` é append-only e faz esse papel).
