-- Monte Trip 2028 — totais públicos do caixa.
-- Rodar depois de 0006_documentos.sql.
--
-- Visitantes não leem nenhuma tabela. Veem só estes totais agregados, sem nomes nem valores por aluno.
-- As colunas antigas de resumo_publico() continuam iguais (o site publicado segue funcionando).

drop function if exists public.resumo_publico();
create function public.resumo_publico()
returns table (
  total_arrecadado bigint,      -- mensalidades (estornos descontados)
  alunos_ativos bigint,
  pagamentos bigint,            -- pagamentos válidos (estornados não contam)
  atualizado_em timestamptz,
  arrecadacoes_liquido bigint,  -- receitas − custos das ações
  despesas bigint,
  rendimentos bigint,
  saldo bigint                  -- tudo que entrou − tudo que saiu
)
language sql stable security definer set search_path = public as $$
  select
    coalesce((select sum(valor) from public.payments), 0)::bigint,
    (select count(*) from public.students where status = 'ativo'),
    (select count(*) from public.payments where estorno_de is null)
      - (select count(*) from public.payments where estorno_de is not null),
    (select max(registrado_em) from public.livro_caixa),
    coalesce((select sum(valor) from public.livro_caixa where origem in ('arrecadacao', 'custo_arrecadacao')), 0)::bigint,
    coalesce((select -sum(valor) from public.livro_caixa where origem = 'despesa'), 0)::bigint,
    coalesce((select sum(valor) from public.livro_caixa where origem = 'rendimento'), 0)::bigint,
    coalesce((select sum(valor) from public.livro_caixa), 0)::bigint
$$;
revoke all on function public.resumo_publico() from public;
grant execute on function public.resumo_publico() to anon, authenticated;

-- Totais por mês (para o gráfico "Realizado" do Painel). Só somas mensais.
create or replace function public.resumo_publico_mensal()
returns table (mes text, entradas bigint, saidas bigint, rendimentos bigint)
language sql stable security definer set search_path = public as $$
  select to_char(date_trunc('month', data), 'YYYY-MM'),
         coalesce(sum(valor) filter (where origem in ('mensalidade', 'arrecadacao')), 0)::bigint,
         coalesce(-sum(valor) filter (where origem in ('despesa', 'custo_arrecadacao')), 0)::bigint,
         coalesce(sum(valor) filter (where origem = 'rendimento'), 0)::bigint
    from public.livro_caixa
   group by 1 order by 1
$$;
revoke all on function public.resumo_publico_mensal() from public;
grant execute on function public.resumo_publico_mensal() to anon, authenticated;

-- Situação de todas as parcelas (para a tela de mensalidades e relatórios da gestão).
-- security_invoker: só admin e supervisor enxergam linhas.
create view public.parcelas_situacao with (security_invoker = true) as
  select i.id, i.student_id, i.numero, i.vencimento, s.valor, s.adicional, s.devido, s.pago, s.restante, s.status
    from public.installments i
    cross join lateral public.situacao_parcela(i.id, current_date) s;
