-- Monte Trip 2028 — conferência de lançamentos e saldo bancário informado.
-- Rodar depois de 0007_resumo_publico.sql (SQL Editor → New query → colar → Run).
--
-- Conferência: alguém (admin ou professor) confere um pagamento, despesa, lançamento de ação ou
--   rendimento contra o extrato. Cada conferência é uma linha nova (nada é editado nem apagado):
--   a situação atual é a conferência mais recente; as anteriores ficam como histórico.
-- Saldo bancário: o admin informa o saldo que aparece no extrato numa data. O sistema compara com o
--   saldo registrado (livro-caixa) até aquela data. Também só se acrescenta, nunca se edita.

-- ---------------------------------------------------------------- conferências
create table public.conferencias (
  id            bigint generated always as identity primary key,
  tabela        text not null check (tabela in ('payments', 'expenses', 'fundraising_entries', 'yields')),
  registro_id   uuid not null,
  situacao      text not null check (situacao in ('conferido', 'divergente')),
  observacao    text check (observacao is null or length(observacao) <= 300),
  conferido_por uuid not null default auth.uid() references auth.users (id),
  conferido_em  timestamptz not null default now(),
  -- divergência precisa de explicação
  check (situacao = 'conferido' or length(trim(coalesce(observacao, ''))) >= 3)
);
create index conferencias_registro_idx on public.conferencias (tabela, registro_id, id desc);

-- O lançamento conferido precisa existir na tabela indicada.
create or replace function public.validar_conferencia()
returns trigger language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  execute format('select exists (select 1 from public.%I where id = $1)', new.tabela) into ok using new.registro_id;
  if not ok then raise exception 'Lançamento não encontrado para conferência'; end if;
  return new;
end $$;
create trigger conferencias_validar before insert on public.conferencias
  for each row execute function public.validar_conferencia();

alter table public.conferencias enable row level security;
create policy "gestão lê conferências" on public.conferencias for select using (public.pode_ler_tudo());
-- admin e professor conferem; cada um assina com o próprio usuário
create policy "gestão confere" on public.conferencias for insert
  with check (public.pode_ler_tudo() and conferido_por = auth.uid());
revoke update, delete on public.conferencias from anon, authenticated;

-- ---------------------------------------------------------------- saldo bancário informado
create table public.saldos_bancarios (
  id             uuid primary key default gen_random_uuid(),
  data           date not null check (data >= date '2024-01-01'),
  valor          bigint not null check (valor between -100000000 and 100000000),
  instituicao    text check (instituicao is null or length(instituicao) <= 120),
  observacao     text check (observacao is null or length(observacao) <= 300),
  registrado_por uuid not null default auth.uid() references auth.users (id),
  registrado_em  timestamptz not null default now()
);
create index saldos_bancarios_data_idx on public.saldos_bancarios (data desc, registrado_em desc);

create or replace function public.validar_saldo_bancario()
returns trigger language plpgsql as $$
begin
  if new.data > current_date + 1 then raise exception 'Data no futuro'; end if;
  return new;
end $$;
create trigger saldos_bancarios_validar before insert on public.saldos_bancarios
  for each row execute function public.validar_saldo_bancario();
create trigger saldos_bancarios_audit after insert or update or delete on public.saldos_bancarios
  for each row execute function public.auditar();

alter table public.saldos_bancarios enable row level security;
create policy "gestão lê saldos bancários" on public.saldos_bancarios for select using (public.pode_ler_tudo());
create policy "admin informa saldo bancário" on public.saldos_bancarios for insert
  with check (public.e_admin() and registrado_por = auth.uid());
revoke update, delete on public.saldos_bancarios from anon, authenticated;

-- ---------------------------------------------------------------- reforço de segurança
-- Funções internas (gatilhos e validações) não precisam ser chamadas pela API.
revoke all on function public.auditar() from public, anon, authenticated;
revoke all on function public.validar_estorno() from public, anon, authenticated;
revoke all on function public.validar_estorno_generico() from public, anon, authenticated;
revoke all on function public.validar_conferencia() from public, anon, authenticated;
revoke all on function public.validar_saldo_bancario() from public, anon, authenticated;
revoke all on function public.tocar_atualizado_em() from public, anon, authenticated;
-- Visitante não precisa calcular situação de parcela (só a gestão lê parcelas).
revoke all on function public.situacao_parcela(uuid, date) from public, anon;
