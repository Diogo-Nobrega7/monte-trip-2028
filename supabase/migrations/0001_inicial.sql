-- Monte Trip 2028 — estrutura inicial (etapa 2).
-- Rodar inteiro no Supabase: SQL Editor → New query → colar → Run.
--
-- Regras:
--   * valores em centavos (bigint)
--   * pagamentos não podem ser editados nem apagados; correção = estorno
--   * só o admin grava; admin e supervisor leem; visitantes veem apenas totais

-- ---------------------------------------------------------------- perfis
create table public.profiles (
  id    uuid primary key references auth.users (id) on delete cascade,
  nome  text not null,
  papel text not null check (papel in ('admin', 'supervisor', 'responsavel', 'aluno')),
  criado_em timestamptz not null default now()
);

-- Papel de quem está logado (null para visitante). security definer evita recursão no RLS.
create or replace function public.papel_atual()
returns text language sql stable security definer set search_path = public as $$
  select papel from public.profiles where id = auth.uid()
$$;

create or replace function public.e_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.papel_atual() = 'admin', false)
$$;

create or replace function public.pode_ler_tudo()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.papel_atual() in ('admin', 'supervisor'), false)
$$;

alter table public.profiles enable row level security;
create policy "ver o próprio perfil" on public.profiles
  for select using (id = auth.uid() or public.pode_ler_tudo());
-- Sem policy de insert/update/delete: perfis são criados pelo SQL Editor (ver docs/PUBLICAR.md).

-- ---------------------------------------------------------------- alunos
create table public.students (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null check (length(trim(nome)) between 2 and 120),
  responsavel_nome    text check (responsavel_nome is null or length(responsavel_nome) <= 120),
  responsavel_contato text check (responsavel_contato is null or length(responsavel_contato) <= 120),
  adesao_em           date not null default current_date,
  status              text not null default 'ativo' check (status in ('ativo', 'desistente')),
  criado_em           timestamptz not null default now(),
  criado_por          uuid not null default auth.uid() references auth.users (id)
);

alter table public.students enable row level security;
create policy "admin e supervisor leem alunos" on public.students
  for select using (public.pode_ler_tudo());
create policy "admin cadastra alunos" on public.students
  for insert with check (public.e_admin());
create policy "admin atualiza alunos" on public.students
  for update using (public.e_admin()) with check (public.e_admin());
-- sem delete: aluno que sai vira status 'desistente', mantendo o histórico.

-- ---------------------------------------------------------------- pagamentos
create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.students (id),
  valor           bigint not null,
  pago_em         date not null,
  metodo          text not null check (metodo in ('pix', 'transferencia', 'dinheiro')),
  observacao      text check (observacao is null or length(observacao) <= 300),
  estorno_de      uuid unique references public.payments (id),
  idempotency_key uuid not null unique,
  registrado_por  uuid not null default auth.uid() references auth.users (id),
  registrado_em   timestamptz not null default now(),
  -- pagamento normal é positivo; estorno é negativo e aponta para o original
  check ((estorno_de is null and valor > 0) or (estorno_de is not null and valor < 0)),
  check (pago_em >= date '2024-01-01')
);
create index payments_student_idx on public.payments (student_id);

-- Estorno precisa anular exatamente o pagamento original, do mesmo aluno.
create or replace function public.validar_estorno()
returns trigger language plpgsql as $$
declare o public.payments;
begin
  if new.pago_em > current_date + 1 then raise exception 'Data de pagamento no futuro'; end if;
  if new.estorno_de is null then return new; end if;
  select * into o from public.payments where id = new.estorno_de;
  if o.id is null then raise exception 'Pagamento original não encontrado'; end if;
  if o.estorno_de is not null then raise exception 'Não é possível estornar um estorno'; end if;
  if new.student_id <> o.student_id or new.valor <> -o.valor then
    raise exception 'Estorno deve ter o mesmo aluno e o valor oposto ao original';
  end if;
  return new;
end $$;
create trigger payments_validar_estorno before insert on public.payments
  for each row execute function public.validar_estorno();

alter table public.payments enable row level security;
create policy "admin e supervisor leem pagamentos" on public.payments
  for select using (public.pode_ler_tudo());
create policy "admin registra pagamentos" on public.payments
  for insert with check (public.e_admin() and registrado_por = auth.uid());
-- imutável: nenhum papel pode editar ou apagar
revoke update, delete on public.payments from anon, authenticated;

-- ---------------------------------------------------------------- auditoria
create table public.audit_log (
  id          bigint generated always as identity primary key,
  tabela      text not null,
  registro_id uuid not null,
  acao        text not null,
  antes       jsonb,
  depois      jsonb,
  usuario     uuid default auth.uid(),
  em          timestamptz not null default now()
);

create or replace function public.auditar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (tabela, registro_id, acao, antes, depois)
  values (tg_table_name, coalesce(new.id, old.id), tg_op,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;
create trigger students_audit after insert or update or delete on public.students
  for each row execute function public.auditar();
create trigger payments_audit after insert or update or delete on public.payments
  for each row execute function public.auditar();

alter table public.audit_log enable row level security;
create policy "admin e supervisor leem auditoria" on public.audit_log
  for select using (public.pode_ler_tudo());
revoke insert, update, delete on public.audit_log from anon, authenticated;

-- ---------------------------------------------------------------- resumo público
-- Único dado aberto a visitantes: totais, sem nomes nem valores por aluno.
create or replace function public.resumo_publico()
returns table (total_arrecadado bigint, alunos_ativos bigint, pagamentos bigint, atualizado_em timestamptz)
language sql stable security definer set search_path = public as $$
  select
    coalesce((select sum(valor) from public.payments), 0)::bigint,
    (select count(*) from public.students where status = 'ativo'),
    (select count(*) from public.payments where estorno_de is null)
      - (select count(*) from public.payments where estorno_de is not null),
    (select max(registrado_em) from public.payments)
$$;
revoke all on function public.resumo_publico() from public;
grant execute on function public.resumo_publico() to anon, authenticated;
