-- Monte Trip 2028 — arrecadações, despesas, rendimentos e livro-caixa.
-- Rodar depois de 0003_mensalidades.sql.
--
-- Regras:
--   * Lançamentos de dinheiro (receitas, custos, despesas, rendimentos) não são editados nem apagados.
--     Correção = estorno (valor oposto que aponta para o original) e, se preciso, um novo lançamento.
--   * Informações descritivas (nome da ação, responsável, descrição e justificativa da despesa)
--     podem ser corrigidas pelo admin; toda mudança fica no audit_log.
--   * O livro-caixa é uma visão (não uma cópia): soma tudo que entrou e saiu, sem chance de divergir.

-- ---------------------------------------------------------------- arrecadações
create table public.fundraisings (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null check (length(trim(titulo)) between 2 and 120),
  tipo        text not null check (tipo in ('rifa', 'venda', 'evento', 'doacao', 'patrocinio')),
  data        date not null check (data >= date '2024-01-01'),
  responsavel text check (responsavel is null or length(responsavel) <= 120),
  observacoes text check (observacoes is null or length(observacoes) <= 1000),
  criado_por  uuid not null default auth.uid() references auth.users (id),
  criado_em   timestamptz not null default now()
);

create table public.fundraising_entries (
  id              uuid primary key default gen_random_uuid(),
  fundraising_id  uuid not null references public.fundraisings (id),
  tipo            text not null check (tipo in ('receita', 'custo')),
  valor           bigint not null,
  data            date not null check (data >= date '2024-01-01'),
  descricao       text check (descricao is null or length(descricao) <= 300),
  estorno_de      uuid unique references public.fundraising_entries (id),
  idempotency_key uuid not null unique,
  registrado_por  uuid not null default auth.uid() references auth.users (id),
  registrado_em   timestamptz not null default now(),
  check ((estorno_de is null and valor > 0) or (estorno_de is not null and valor < 0))
);
create index fundraising_entries_acao_idx on public.fundraising_entries (fundraising_id);

-- ---------------------------------------------------------------- despesas
create table public.expenses (
  id              uuid primary key default gen_random_uuid(),
  descricao       text not null check (length(trim(descricao)) between 2 and 160),
  categoria       text not null check (categoria in ('agencia', 'transporte', 'hospedagem', 'ingressos', 'materiais', 'taxas', 'devolucao', 'outros')),
  data            date not null check (data >= date '2024-01-01'),
  valor           bigint not null,
  justificativa   text not null check (length(trim(justificativa)) between 3 and 1000),
  estorno_de      uuid unique references public.expenses (id),
  idempotency_key uuid not null unique,
  registrado_por  uuid not null default auth.uid() references auth.users (id),
  registrado_em   timestamptz not null default now(),
  check ((estorno_de is null and valor > 0) or (estorno_de is not null and valor < 0))
);
create index expenses_data_idx on public.expenses (data);

-- ---------------------------------------------------------------- rendimentos (do extrato)
create table public.yields (
  id              uuid primary key default gen_random_uuid(),
  data            date not null check (data >= date '2024-01-01'),
  valor           bigint not null,
  instituicao     text check (instituicao is null or length(instituicao) <= 120),
  descricao       text check (descricao is null or length(descricao) <= 300),
  estorno_de      uuid unique references public.yields (id),
  idempotency_key uuid not null unique,
  registrado_por  uuid not null default auth.uid() references auth.users (id),
  registrado_em   timestamptz not null default now(),
  check ((estorno_de is null and valor > 0) or (estorno_de is not null and valor < 0))
);

-- ---------------------------------------------------------------- validação de estornos
-- Genérica: o estorno anula exatamente o original (mesmo valor com sinal trocado), uma vez só,
-- e não se estorna um estorno. Campos que precisam bater com o original vêm em TG_ARGV.
create or replace function public.validar_estorno_generico()
returns trigger language plpgsql set search_path = public as $$
declare
  o jsonb;
  n jsonb := to_jsonb(new);
  campo text;
  data_col text := tg_argv[0];
begin
  if (n->>data_col)::date > current_date + 1 then raise exception 'Data no futuro'; end if;
  if new.estorno_de is null then return new; end if;
  execute format('select to_jsonb(t) from %I.%I t where id = $1', tg_table_schema, tg_table_name)
    into o using new.estorno_de;
  if o is null then raise exception 'Lançamento original não encontrado'; end if;
  if o->>'estorno_de' is not null then raise exception 'Não é possível estornar um estorno'; end if;
  if (n->>'valor')::bigint <> -(o->>'valor')::bigint then raise exception 'O estorno deve ter o valor oposto ao original'; end if;
  for i in 1 .. tg_nargs - 1 loop
    campo := tg_argv[i];
    if n->campo is distinct from o->campo then raise exception 'O estorno deve manter o mesmo campo % do original', campo; end if;
  end loop;
  return new;
end $$;

create trigger fundraising_entries_validar before insert on public.fundraising_entries
  for each row execute function public.validar_estorno_generico('data', 'fundraising_id', 'tipo');
create trigger expenses_validar before insert on public.expenses
  for each row execute function public.validar_estorno_generico('data', 'categoria');
create trigger yields_validar before insert on public.yields
  for each row execute function public.validar_estorno_generico('data');

-- ---------------------------------------------------------------- auditoria
create trigger fundraisings_audit after insert or update or delete on public.fundraisings
  for each row execute function public.auditar();
create trigger fundraising_entries_audit after insert or update or delete on public.fundraising_entries
  for each row execute function public.auditar();
create trigger expenses_audit after insert or update or delete on public.expenses
  for each row execute function public.auditar();
create trigger yields_audit after insert or update or delete on public.yields
  for each row execute function public.auditar();

-- ---------------------------------------------------------------- permissões
alter table public.fundraisings enable row level security;
alter table public.fundraising_entries enable row level security;
alter table public.expenses enable row level security;
alter table public.yields enable row level security;

create policy "admin e supervisor leem ações" on public.fundraisings for select using (public.pode_ler_tudo());
create policy "admin cadastra ações" on public.fundraisings for insert with check (public.e_admin() and criado_por = auth.uid());
create policy "admin corrige ações" on public.fundraisings for update using (public.e_admin()) with check (public.e_admin());
revoke delete on public.fundraisings from anon, authenticated;
revoke update on public.fundraisings from anon, authenticated;
grant update (titulo, tipo, data, responsavel, observacoes) on public.fundraisings to authenticated;

create policy "admin e supervisor leem lançamentos de ações" on public.fundraising_entries for select using (public.pode_ler_tudo());
create policy "admin registra lançamentos de ações" on public.fundraising_entries for insert with check (public.e_admin() and registrado_por = auth.uid());
revoke update, delete on public.fundraising_entries from anon, authenticated;

create policy "admin e supervisor leem despesas" on public.expenses for select using (public.pode_ler_tudo());
create policy "admin registra despesas" on public.expenses for insert with check (public.e_admin() and registrado_por = auth.uid());
create policy "admin corrige descrição de despesas" on public.expenses for update using (public.e_admin()) with check (public.e_admin());
revoke delete on public.expenses from anon, authenticated;
revoke update on public.expenses from anon, authenticated;
-- valor, data e categoria nunca mudam (categoria entra no estorno); só textos
grant update (descricao, justificativa) on public.expenses to authenticated;

create policy "admin e supervisor leem rendimentos" on public.yields for select using (public.pode_ler_tudo());
create policy "admin registra rendimentos" on public.yields for insert with check (public.e_admin() and registrado_por = auth.uid());
revoke update, delete on public.yields from anon, authenticated;

-- ---------------------------------------------------------------- ação com receita e custos de uma vez
create or replace function public.registrar_arrecadacao(
  p_titulo text, p_tipo text, p_data date, p_responsavel text, p_observacoes text,
  p_receita bigint, p_custos bigint, p_chave uuid
) returns uuid language plpgsql security invoker set search_path = public as $$
declare novo uuid;
begin
  if coalesce(p_receita, 0) < 0 or coalesce(p_custos, 0) < 0 then raise exception 'Valores não podem ser negativos'; end if;
  insert into public.fundraisings (titulo, tipo, data, responsavel, observacoes)
  values (trim(p_titulo), p_tipo, p_data, nullif(trim(p_responsavel), ''), nullif(trim(p_observacoes), ''))
  returning id into novo;
  if coalesce(p_receita, 0) > 0 then
    insert into public.fundraising_entries (fundraising_id, tipo, valor, data, descricao, idempotency_key)
    values (novo, 'receita', p_receita, p_data, 'Receita bruta', p_chave);
  end if;
  if coalesce(p_custos, 0) > 0 then
    insert into public.fundraising_entries (fundraising_id, tipo, valor, data, descricao, idempotency_key)
    values (novo, 'custo', p_custos, p_data, 'Custos', md5(p_chave::text || ':custo')::uuid);
  end if;
  return novo;
end $$;
revoke all on function public.registrar_arrecadacao(text, text, date, text, text, bigint, bigint, uuid) from public;
grant execute on function public.registrar_arrecadacao(text, text, date, text, text, bigint, bigint, uuid) to authenticated;

-- ---------------------------------------------------------------- livro-caixa
-- Toda entrada e saída numa lista só. `valor` já vem com sinal: + entra no caixa, − sai.
-- security_invoker: quem consulta só vê o que as políticas acima permitem.
create view public.livro_caixa with (security_invoker = true) as
  select 'mensalidade'::text as origem, p.id, p.pago_em as data, p.valor as valor,
         p.estorno_de is not null as estorno, p.student_id as referencia, p.observacao as descricao, p.registrado_em
    from public.payments p
  union all
  select case e.tipo when 'receita' then 'arrecadacao' else 'custo_arrecadacao' end, e.id, e.data,
         case e.tipo when 'receita' then e.valor else -e.valor end,
         e.estorno_de is not null, e.fundraising_id, coalesce(f.titulo || ' — ', '') || coalesce(e.descricao, ''), e.registrado_em
    from public.fundraising_entries e join public.fundraisings f on f.id = e.fundraising_id
  union all
  select 'despesa', d.id, d.data, -d.valor, d.estorno_de is not null, null, d.descricao, d.registrado_em
    from public.expenses d
  union all
  select 'rendimento', y.id, y.data, y.valor, y.estorno_de is not null, null,
         coalesce(y.instituicao || ' — ', '') || coalesce(y.descricao, 'Rendimento'), y.registrado_em
    from public.yields y;
