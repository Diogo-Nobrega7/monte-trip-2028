-- Monte Trip 2028 — agências e propostas.
-- Rodar depois de 0004_caixa.sql.
--
-- Propostas são cotações (não movimentam dinheiro): podem ser editadas, e cada mudança fica no
-- audit_log como histórico. Uma proposta descartada continua guardada. O sistema compara, mas
-- nunca escolhe a vencedora: a decisão é das pessoas.

-- CNPJ: 14 dígitos com dígitos verificadores válidos. Mesma regra de src/lib/cnpj.ts.
create or replace function public.cnpj_valido(c text)
returns boolean language plpgsql immutable as $$
declare
  d int[];
  pesos1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  pesos2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  s int; r int; i int;
begin
  if c is null or c !~ '^\d{14}$' or c ~ '^(\d)\1{13}$' then return false; end if;
  select array_agg(x::int order by ord) into d from unnest(string_to_array(c, null)) with ordinality as t(x, ord);
  s := 0; for i in 1..12 loop s := s + d[i] * pesos1[i]; end loop;
  r := s % 11; if (case when r < 2 then 0 else 11 - r end) <> d[13] then return false; end if;
  s := 0; for i in 1..13 loop s := s + d[i] * pesos2[i]; end loop;
  r := s % 11; return (case when r < 2 then 0 else 11 - r end) = d[14];
end $$;

create table public.agencies (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (length(trim(nome)) between 2 and 120),
  cnpj          text check (cnpj is null or public.cnpj_valido(cnpj)),
  cadastur      text check (cadastur is null or length(cadastur) <= 40),
  contato_nome  text check (contato_nome is null or length(contato_nome) <= 120),
  telefone      text check (telefone is null or length(telefone) <= 40),
  email         text check (email is null or (length(email) <= 120 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  site          text check (site is null or length(site) <= 200),
  observacoes   text check (observacoes is null or length(observacoes) <= 1000),
  criado_por    uuid not null default auth.uid() references auth.users (id),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index agencies_cnpj_unico on public.agencies (cnpj) where cnpj is not null;

-- Serviços de uma proposta: {"transporte": {"incluso": true, "detalhe": "Ônibus executivo"}, ...}
create or replace function public.servicos_validos(s jsonb)
returns boolean language sql immutable as $$
  select jsonb_typeof(s) = 'object'
     and (select bool_and(
            k in ('transporte', 'hospedagem', 'ingressos', 'alimentacao', 'seguro', 'monitoramento')
            and jsonb_typeof(s->k) = 'object'
            and jsonb_typeof(s->k->'incluso') = 'boolean'
            and (s->k->'detalhe' is null or jsonb_typeof(s->k->'detalhe') = 'null'
                 or (jsonb_typeof(s->k->'detalhe') = 'string' and length(s->k->>'detalhe') <= 300)))
          from jsonb_object_keys(s) k) is not false
$$;

create table public.proposals (
  id                    uuid primary key default gen_random_uuid(),
  agency_id             uuid not null references public.agencies (id),
  preco_aluno           bigint not null check (preco_aluno between 1 and 10000000),
  validade              date,
  recebida_em           date not null default current_date,
  condicoes_pagamento   text check (condicoes_pagamento is null or length(condicoes_pagamento) <= 1000),
  politica_cancelamento text check (politica_cancelamento is null or length(politica_cancelamento) <= 1000),
  servicos              jsonb not null default '{}'::jsonb check (public.servicos_validos(servicos)),
  observacoes           text check (observacoes is null or length(observacoes) <= 1000),
  status                text not null default 'ativa' check (status in ('ativa', 'descartada')),
  criado_por            uuid not null default auth.uid() references auth.users (id),
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now()
);
create index proposals_agency_idx on public.proposals (agency_id);

create or replace function public.tocar_atualizado_em()
returns trigger language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;
create trigger agencies_tocar before update on public.agencies for each row execute function public.tocar_atualizado_em();
create trigger proposals_tocar before update on public.proposals for each row execute function public.tocar_atualizado_em();

create trigger agencies_audit after insert or update or delete on public.agencies
  for each row execute function public.auditar();
create trigger proposals_audit after insert or update or delete on public.proposals
  for each row execute function public.auditar();

alter table public.agencies enable row level security;
alter table public.proposals enable row level security;
create policy "admin e supervisor leem agências" on public.agencies for select using (public.pode_ler_tudo());
create policy "admin cadastra agências" on public.agencies for insert with check (public.e_admin() and criado_por = auth.uid());
create policy "admin edita agências" on public.agencies for update using (public.e_admin()) with check (public.e_admin());
create policy "admin e supervisor leem propostas" on public.proposals for select using (public.pode_ler_tudo());
create policy "admin cadastra propostas" on public.proposals for insert with check (public.e_admin() and criado_por = auth.uid());
create policy "admin edita propostas" on public.proposals for update using (public.e_admin()) with check (public.e_admin());
-- sem exclusão: proposta que não serve fica "descartada"
revoke delete on public.agencies, public.proposals from anon, authenticated;
revoke update on public.agencies, public.proposals from anon, authenticated;
grant update (nome, cnpj, cadastur, contato_nome, telefone, email, site, observacoes) on public.agencies to authenticated;
grant update (agency_id, preco_aluno, validade, recebida_em, condicoes_pagamento, politica_cancelamento, servicos, observacoes, status)
  on public.proposals to authenticated;
