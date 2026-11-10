# Arquitetura

## Visão geral
```
Navegador (React SPA, GitHub Pages)
  ├─ features/*      telas
  ├─ lib/            cálculos puros (testados): finance, installments, settings, ledger, period, csv, import, proposals, cnpj
  └─ data/           repositórios (único lugar que fala com o banco)
        │  supabase-js (JWT do usuário; só a publishable key no navegador)
        ▼
Supabase
  ├─ Auth            login por e-mail (cadastro aberto desligado)
  ├─ Postgres + RLS  dados e permissões por linha; funções para operações sensíveis
  ├─ Storage         bucket privado "documentos" (PDF/imagens, 10 MB)
  └─ Triggers        auditoria, validação de estornos e de saldo de parcela
```
A interface só esconde botões. Quem bloqueia é o banco (RLS, revoke e funções que conferem o papel).

## Papéis
| Papel | Acesso |
|---|---|
| admin (Davi) | grava e altera tudo, inclusive regras financeiras (valem na hora, com histórico) |
| supervisor (professor) | só leitura de tudo |
| visitante (sem login) | só totais (`resumo_publico`, `resumo_publico_mensal`), configuração vigente e documentos públicos |
| responsavel, aluno | previstos no banco; área própria ainda não implementada |

## Tabelas (migrações em `supabase/migrations`)
Valores em `bigint` (centavos). Percentuais em pontos-base (1500 = 15%).

| Migração | Tabelas e funções |
|---|---|
| 0001 | `profiles`, `students`, `payments` (imutável, estorno), `audit_log`, `resumo_publico()` |
| 0002 | `config_versions` (versões, nunca sobrescreve), `config_proposals` (pendente/aprovada/rejeitada/cancelada); `configuracao_vigente()`, `propor_configuracoes()`, `decidir_proposta()`, `cancelar_proposta()`, `validar_configuracoes()` |
| 0003 | `installments` (parcela guarda valor e adicional da época), `payments.installment_id`; `situacao_parcela()`, `sincronizar_parcelas()`, `registrar_pagamento_distribuido()`; gatilho impede pagar acima do saldo |
| 0004 | `fundraisings` + `fundraising_entries` (receita/custo, imutável), `expenses` (imutável, só textos corrigíveis), `yields`; visão `livro_caixa`; `registrar_arrecadacao()` |
| 0005 | `agencies`, `proposals` (editáveis com auditoria, descartar em vez de apagar); `cnpj_valido()` |
| 0006 | bucket `documentos`, `documents` (exclusão lógica com motivo), políticas do Storage; `excluir_documento()` |
| 0007 | `resumo_publico()` ampliado (saldo, despesas, rendimentos), `resumo_publico_mensal()`, visão `parcelas_situacao` |

## Regras e garantias
- **Dinheiro imutável:** pagamentos, lançamentos de ações, despesas e rendimentos não têm UPDATE/DELETE
  (revoke). Correção = estorno com valor oposto, validado por gatilho (mesmo valor, uma vez, nunca estorno de estorno).
- **Duplicidade:** `idempotency_key` única, gerada quando o formulário abre.
- **Parcelas:** pago no prazo = pagamentos válidos até o vencimento; vencida com falta → adicional sobre o que
  faltou, uma vez, arredondado ao centavo. Parcial nunca vira "paga". Mesma regra em SQL e em `lib/installments.ts`,
  com os mesmos cenários de teste nos dois lados.
- **Configurações:** o admin altera tudo e vale na hora; cada mudança é uma versão nova com autor, motivo e antes/depois.
  As tabelas e funções de proposta/aprovação (`config_proposals`, `decidir_proposta`) existem mas não são usadas
  (decisão de 2026-11-10: professor só acompanha).
- **Parcelas só com regras definitivas:** `sincronizar_parcelas()` recusa enquanto `provisorio = true`. Só parcelas
  futuras sem pagamento são atualizadas; vencidas ou pagas nunca mudam.
- **Saldo:** soma da visão `livro_caixa` (pagamentos + ações + rendimentos − despesas). É uma visão, não uma cópia:
  não diverge. Conferível contra o extrato.
- **Auditoria:** gatilho grava antes/depois de toda mudança em alunos, parcelas, pagamentos, caixa, agências,
  propostas e documentos. Ninguém escreve no `audit_log`.
- **Documentos:** bucket privado; leitura por link assinado de 5 minutos. Só regulamento e relatórios podem ser
  públicos, e nunca se ligados a aluno, despesa, ação ou proposta (check no banco).

## Testes
- `npm test`: cálculos (parcelas, configurações, livro-caixa, CSV, importação, CNPJ, propostas, juros).
- `scripts/db-test.sh`: migrações + 119 verificações de permissão e de regra num Postgres local que imita o Supabase.
- `scripts/e2e/`: Storage e PostgREST oficiais (Docker) + login de teste; navegador faz o fluxo completo (55 verificações).
- `scripts/smoke.mjs`: telas em modo demonstração (sem banco).
