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
- Vitest (testes), playwright-core (teste de fumaça), read-excel-file 9.3.12 (importação, versão fixa)
- Supabase (Postgres, Auth, RLS, Storage) — ver docs/ARQUITETURA.md

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
PGHOST=... PGPORT=... PGUSER=postgres scripts/db-test.sh   # migrações + RLS num Postgres local
scripts/e2e/subir.sh && <build com a chave impressa> && node scripts/e2e/e2e.cjs  # ponta a ponta (Docker)
node scripts/restaurar-backup.mjs backup.json > restaurar.sql   # recuperação (docs/BACKUP.md)
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
    patterns/   ListPage, TableCard, StatRow, PeriodFilter, ReverseModal (estorno), AuditModal (histórico), AttachModal (anexo)
  config/       defaults.ts — cenário inicial ilustrativo (só modo demonstração)
  data/         db.ts, repo.ts (alunos/pagamentos), settings, installments, cash, documents, agencies, audit, backup, spreadsheet
  features/     uma pasta por módulo (dashboard, students, installments, fundraising, expenses,
                reports, simulator, trip, agencies, documents, settings, auth)
  hooks/        useHashRoute, useTheme
  lib/          funções puras com testes: finance, installments, settings, ledger, period, csv, import, proposals, cnpj, payments
  types/        domain.ts
supabase/migrations  0001–0007 (rodar em ordem no SQL Editor)
supabase/tests       Supabase de mentira + testes de RLS e regras (scripts/db-test.sh)
scripts/e2e          ambiente local com Storage/PostgREST oficiais + teste de navegador
```

## Convenções
- Rotas por hash simples: `#painel`, `#alunos`… (sem barras ou query string).
- Cores só via tokens CSS (src/index.css) → classes `bg-surface`, `text-muted`, `bg-accent`, `bg-gold`…
- Nada de componente visual novo sem antes verificar se já existe em components/ui.
- Tema: claro/escuro/sistema via `data-theme` no `<html>`.
- Novo módulo: criar `features/<modulo>/<Modulo>Page.tsx`, registrar em `app/routes.ts` e em `App.tsx`.
- Cálculos financeiros apenas em `lib/` como funções puras, sempre com teste. Regra que também vive no banco
  (parcelas, CNPJ, validação de configurações) tem os mesmos cenários de teste em `lib/*.test.ts` e `supabase/tests`.
- Banco: toda mudança é uma migração nova numerada; nunca editar uma já rodada no Supabase. Escrita sensível
  passa por função `security definer` que confere o papel; tabelas de dinheiro sem UPDATE/DELETE.
- Sem permissão de leitura, a tela mostra só o aviso (nunca zeros que pareçam dados reais).
- Textos da interface em português, voz ativa, sem jargão técnico.

## Decisões
- Vite SPA em vez de Next.js: não há necessidade de SSR; deploy estático; o backend é o Supabase.
- Supabase: Postgres relacional + autenticação + RLS resolvem multiusuário e permissões sem servidor próprio.
- Juros: taxa mensal equivalente (1+a)^(1/12)−1, depósitos postecipados. Validado contra a tabela do briefing.

## Estado atual (2026-11-10)
Etapas 1 a 6 implementadas no ramo `claude/sistema-completo`: configurações com histórico (admin altera tudo,
na hora; professor só lê — decisão do usuário em 2026-11-10),
mensalidades (parcelas, parcial, atraso, distribuição, estorno), arrecadações, despesas com comprovante, rendimentos,
documentos no Storage, agências com comparação, prestação de contas (CSV/PDF), importação de alunos e backup.
Testes: 101 unitários, 119 de banco, 55 de ponta a ponta (rodado antes da mudança do professor; refazer). Detalhes: docs/PROGRESSO.md.
Publicação e configuração do Supabase: docs/PUBLICAR.md. Backup: docs/BACKUP.md.
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

## Próxima sessão
1. Confirmar que as migrações 0002–0007 rodaram no Supabase real; depois
   juntar o ramo na main (banco primeiro, site depois — docs/PUBLICAR.md).
2. Conferir no site real: mudança de regra, geração de parcelas, envio de comprovante.
   O teste e2e (scripts/e2e/e2e.cjs) ainda tem o passo do professor aprovando: atualizar.
3. Pendências de produto: área do participante, aprovação de despesas acima de limite, dispensa de adicional.
Decisão: o "ledger" é a visão `livro_caixa` (soma das tabelas imutáveis), não uma tabela copiada.
