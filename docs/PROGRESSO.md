# Progresso

## Etapa 1 — Estrutura visual ✅ (2026-11-07)

### Implementado
- Shell: sidebar fixa (desktop) e menu deslizante (celular), navegação por hash, 10 páginas.
- Tema claro, escuro e automático (segue o sistema).
- Componentes reutilizáveis em `components/ui` e padrão `ListPage`.
- Painel: trajeto Natal → destino como indicador de progresso, métricas, gráfico de projeção, primeiros passos.
- Páginas Alunos, Mensalidades, Arrecadações, Despesas e Agências com busca, filtros, tabela e estado vazio.
- Simulador funcional (só cálculo local, não grava).
- Viagem, Documentos e Configurações exibindo os parâmetros provisórios.
- Biblioteca financeira `lib/finance.ts`.

### Testes executados
- `npm test`: 8/8 passando. Reproduz a tabela do briefing (R$ 976,40 / R$ 1.464,60 / R$ 1.952,79)
  e o cenário de 20 alunos (R$ 39.056; diferença R$ 4.944).
- `npm run typecheck`: sem erros.
- `scripts/smoke.mjs` (Chromium, 1440px e 390px): as 10 rotas abrem, clique na sidebar e no
  menu mobile navega, simulador recalcula ao mover controle, tema escuro aplica `data-theme`,
  sem rolagem horizontal, sem erros de console.

### Limitações conhecidas
- Sem persistência, login ou cadastro (botões "Novo" desabilitados).
- Fontes do Google não carregam no ambiente de teste (cai na fonte do sistema); no navegador carregam.

## Etapa 1.5 — Redesign visual ✅ (2026-11-08)

### Implementado
- Novo design system: tokens (accent azul, gold, planos de profundidade, sombras, raios), docs/DESIGN.md.
- Painel: bilhete de viagem como hero (saudação, status, saldo, falta, meta, trilha com real e projeção),
  5 indicadores numa superfície, gráfico Projeção/Realizado, participação, pendências, próximas etapas.
- Gráficos: tooltip próprio, legenda, depositado × rendimento empilhados, meta tracejada, cores por tema.
- Sidebar reagrupada (Visão geral, Financeiro, Organização, Administração), menu do usuário com tema.
- Celular: barra inferior com atalhos + "Mais", tabelas viram cartões, modal vira folha inferior.
- Componentes novos: Modal, Dropdown, Tooltip, Toast, Field/Input/Select, RangeField, Segmented, Stat,
  AnimatedNumber, Skeleton (reservado para carregamento remoto).
- Formulários de cadastro em modal (prévia, botão Salvar desativado até a etapa 2).
- Simulador: campos numéricos + controles, atalhos R$50/75/100, barra de composição, comparação
  de até 3 cenários fixados, aviso de confirmação.
- Rotas, cálculos e testes preservados.

### Testes executados
- `npm test`: 8/8. `npm run typecheck`: sem erros. Build de produção ok.
- `scripts/smoke.mjs`: 28 verificações passando (10 rotas × 2 tamanhos sem rolagem horizontal,
  sidebar, barra inferior, menu "Mais", simulador recalcula R$ 39.056 → R$ 19.528 com R$ 50,
  fixar 2 cenários, modal abre e fecha com Esc, tema escuro pelo menu). Sem erros de console.
- Corrigido durante a revisão: dica que vazava da tela, marcador de projeção mal posicionado,
  anel exibindo ponto com zero inscritos, rótulos do eixo quebrando.

## Etapa 2 (parcial) — Banco, login, pagamentos e publicação (2026-11-10)

### Implementado
- `supabase/migrations/0001_inicial.sql`: profiles (papéis), students, payments (centavos, imutável,
  estorno com valor oposto validado por trigger, idempotency_key única), audit_log por trigger, RLS em tudo,
  `resumo_publico()` com totais para visitantes.
- `src/data`: cliente Supabase (modo demonstração sem variáveis), AuthProvider, repositórios, useRemote.
- Tela Entrar (`#entrar`, fora do menu); menu do usuário com Entrar/Sair.
- Alunos: cadastro real, total pago por aluno, marcar desistente/reativar.
- Pagamentos (rota `#mensalidades`): registrar, listar, filtrar, estornar com motivo.
- Painel: total arrecadado e alunos ativos reais via resumo público.
- `lib/payments.ts`: `parseMoney` (texto → centavos sem float), totais por aluno, estornos.
- Deploy: `.github/workflows/deploy.yml` (testes + build + GitHub Pages). Guia: `docs/PUBLICAR.md`.

### Testes executados
- `npm test`: 28/28. `npm run typecheck`: sem erros. Build ok.
- `scripts/smoke.mjs` com Chrome local (modo demonstração): 28 verificações passando, sem erros de console.

### Não verificado
- Fluxo com banco real (login, gravação, RLS): depende de criar o projeto Supabase.

## Etapa 2 (conclusão) + etapas 3 a 6 — Sistema completo (2026-11-10)

### Implementado
- **Configurações** editáveis com histórico (versões, autor, data, motivo, antes/depois) e aprovação do
  professor para regras financeiras. Painel, simulador, viagem e menu leem a configuração vigente do banco.
- **Mensalidades:** geração de parcelas pelas regras aprovadas, situação paga/parcial/a vencer/atrasada,
  adicional por atraso, pagamento parcial, distribuído (mais antiga primeiro) ou avulso, bloqueio de pagamento
  acima do saldo, estorno, histórico por aluno, indicadores de inadimplência.
- **Alunos:** correção de cadastro com histórico, importação de Excel/CSV com prévia e duplicados,
  desistência com devolução prevista pela regra vigente.
- **Arrecadações:** ações com receita e custos imutáveis, estorno, dados descritivos editáveis, comprovantes, período.
- **Despesas:** categorias, justificativa, comprovante no envio ou depois, estorno, indicador "sem comprovante", período.
- **Documentos:** Storage privado, categorias, público só para regulamento e relatórios, ver/baixar por link
  temporário, exclusão com motivo preservando o registro.
- **Agências:** cadastro com CNPJ validado, propostas com 6 serviços e condições, PDF anexo, histórico,
  comparação lado a lado com destaque por critério (sem vencedora automática).
- **Prestação de contas:** período livre, saldo inicial/final, entradas × saídas por mês, despesas por categoria,
  livro-caixa com saldo, projeção separada e rotulada, CSV (livro-caixa, pagamentos, parcelas, arrecadações,
  despesas), PDF pela impressão do navegador, rendimentos lançados do extrato. Visitante vê só totais.
- **Backup:** JSON completo em Configurações; `scripts/restaurar-backup.mjs` + `docs/BACKUP.md`.
- **Painel** com saldo, despesas, rendimentos, gráfico "Realizado", pendências e próximas etapas reais.

### Testes executados
- `npm test`: 101/101. `npm run typecheck` e `npm run build`: ok.
- `scripts/db-test.sh`: 128 verificações de RLS e regras (visitante, conta sem papel, professor, admin,
  imutabilidade, estornos, parcelas, aprovação, documentos).
- `scripts/e2e`: Storage e PostgREST oficiais + navegador real: 55 verificações (importação, aprovação pelo
  professor, geração de parcelas, pagamentos, estornos, uploads, comparação, CSV, PDF, backup, visitante,
  celular sem rolagem horizontal), sem erros de console.
- Restauração do backup num banco limpo reproduz os mesmos totais e parcelas.

### Não verificado
- No Supabase real (projeto `qhfwefqtgcuulukefvtk`): depende de rodar as migrações 0002–0007 (docs/PUBLICAR.md).
  O login do teste local é um substituto do Supabase Auth.

## Próximas etapas
- Área do participante (responsável vê só o próprio aluno: papéis `responsavel`/`aluno` já existem).
- Aprovação de despesas acima de um limite pelo professor.
- Notificações de vencimento (e-mail/WhatsApp) — depende de serviço externo.
- Dispensa de adicional por atraso (com aprovação do professor).
