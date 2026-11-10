# Arquitetura

## Visão geral
```
Navegador (React SPA)
  ├─ features/*      telas
  ├─ lib/            cálculos puros (testados)
  └─ data/           repositórios  ← etapa 2
        │  supabase-js (JWT do usuário)
        ▼
Supabase
  ├─ Auth            login por e-mail
  ├─ Postgres + RLS  dados e permissões por linha
  ├─ Storage         comprovantes e documentos (buckets privados)
  └─ Triggers        auditoria e saldos
```
A interface nunca decide permissão sozinha: o banco (RLS) é a fonte de verdade.

## Papéis
| Papel | Acesso |
|---|---|
| admin (Davi) | tudo, exceto aprovar mudança de regra financeira |
| supervisor (professor) | leitura total, aprova regras, despesas acima de limite |
| responsavel | dados do próprio aluno, relatórios públicos |
| aluno | parcelas próprias, relatórios públicos |

## Modelo de dados (planejado)
Valores em `bigint` (centavos). Datas em `date`/`timestamptz`.

- `profiles` (id = auth.users.id, nome, papel)
- `settings` (chave, valor jsonb, vigente_desde, aprovado_por) — versionada
- `students` (id, nome, data_nasc, responsavel_nome, responsavel_contato, adesao_em, status, profile_id)
- `installments` (id, student_id, numero, vencimento, valor, status) — único (student_id, numero)
- `payments` (id, installment_id, valor, pago_em, metodo, comprovante_path, idempotency_key único, registrado_por)
- `fundraisings` (id, tipo, titulo, data, receita_bruta, custos, responsavel)
- `expenses` (id, categoria, descricao, data, valor, justificativa, comprovante_path, aprovado_por)
- `ledger` (id, data, tipo entrada|saida|rendimento|estorno, valor, origem_tabela, origem_id, saldo_apos) — append-only
- `investments` (id, instituicao, produto, aplicado_em, valor, saldo_informado_em, saldo)
- `agencies` (id, nome, cnpj, cadastur, contato)
- `proposals` (id, agency_id, preco_aluno, inclui jsonb, condicoes, validade, arquivo_path)
- `documents` (id, tipo, titulo, student_id null, arquivo_path, visibilidade)
- `audit_log` (id, tabela, registro_id, acao, antes jsonb, depois jsonb, usuario, em)

## Garantias financeiras
- Pagamento duplicado bloqueado por `idempotency_key` único.
- Todo pagamento, arrecadação, despesa e rendimento gera linha no `ledger` via trigger.
- Saldo do painel = soma do `ledger`; conferível contra extrato bancário.
- Sem UPDATE/DELETE em `ledger` e `payments` (RLS + revoke); correção por estorno.
