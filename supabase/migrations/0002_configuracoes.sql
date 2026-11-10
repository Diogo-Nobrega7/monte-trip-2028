-- Monte Trip 2028 — configurações editáveis com histórico.
-- Rodar depois de 0001_inicial.sql (SQL Editor → New query → colar → Run).
--
-- Como funciona:
--   * Cada mudança gera uma nova VERSÃO (config_versions). Nada é sobrescrito: a vigente é a última.
--   * O admin altera tudo e a mudança entra na hora, com autor, data, motivo e valores anteriores.
--   * O professor (supervisor) só lê. As tabelas e funções de proposta/aprovação ficam disponíveis
--     para uso futuro, mas o site não as usa: propor_configuracoes() nunca cria proposta.
--   * Ninguém grava nessas tabelas diretamente: só pelas funções abaixo, que conferem o papel.
--   * Percentuais em pontos-base (inteiros): 1500 = 15%. Dinheiro em centavos.

-- ---------------------------------------------------------------- reforço de 0001
-- Aluno nunca é apagado (vira "desistente") e perfis só mudam pelo SQL Editor.
-- O RLS já bloqueava sem dar erro; agora a recusa é explícita.
revoke delete on public.students from anon, authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;

-- ---------------------------------------------------------------- papéis
create or replace function public.e_supervisor()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.papel_atual() = 'supervisor', false)
$$;

-- ---------------------------------------------------------------- validação
-- Chaves que exigem aprovação do supervisor.
create or replace function public.chaves_financeiras()
returns text[] language sql immutable as $$
  select array['mensalidade', 'parcelas', 'mes_inicio', 'dia_vencimento', 'adicional_atraso_bp',
               'devolucao_desistencia_bp', 'novos_pagam_anteriores', 'provisorio']
$$;

create or replace function public.chaves_configuracao()
returns text[] language sql immutable as $$
  select array['destino', 'cidade_destino', 'origem', 'ano', 'data_ida', 'data_volta', 'dias', 'noites',
               'alunos_previstos', 'orcamento_por_aluno', 'rendimento_anual_bp', 'administrador', 'supervisor']
         || public.chaves_financeiras()
$$;

-- Recusa qualquer configuração incompleta ou fora dos limites. Mesmas regras de src/lib/settings.ts.
create or replace function public.validar_configuracoes(v jsonb)
returns void language plpgsql immutable as $$
declare
  k text;
  extra text;
begin
  if v is null or jsonb_typeof(v) <> 'object' then raise exception 'Configuração inválida'; end if;
  foreach k in array public.chaves_configuracao() loop
    if not v ? k then raise exception 'Configuração incompleta: falta %', k; end if;
  end loop;
  select string_agg(key, ', ') into extra from jsonb_object_keys(v) key where key <> all (public.chaves_configuracao());
  if extra is not null then raise exception 'Campo desconhecido na configuração: %', extra; end if;

  -- textos
  foreach k in array array['destino', 'cidade_destino', 'origem', 'administrador', 'supervisor'] loop
    if jsonb_typeof(v->k) <> 'string' or length(trim(v->>k)) not between 1 and 80 then
      raise exception 'Preencha "%" (até 80 caracteres)', k;
    end if;
  end loop;
  -- inteiros com limites
  if jsonb_typeof(v->'ano') <> 'number' or (v->>'ano') !~ '^\d+$' or (v->>'ano')::int not between 2026 and 2040 then raise exception 'Ano da viagem inválido'; end if;
  if jsonb_typeof(v->'dias') <> 'number' or (v->>'dias') !~ '^\d+$' or (v->>'dias')::int not between 1 and 30 then raise exception 'Duração em dias inválida'; end if;
  if jsonb_typeof(v->'noites') <> 'number' or (v->>'noites') !~ '^\d+$' or (v->>'noites')::int not between 0 and 30 then raise exception 'Número de noites inválido'; end if;
  if (v->>'noites')::int > (v->>'dias')::int then raise exception 'Noites não podem passar do número de dias'; end if;
  if jsonb_typeof(v->'alunos_previstos') <> 'number' or (v->>'alunos_previstos') !~ '^\d+$' or (v->>'alunos_previstos')::int not between 1 and 300 then raise exception 'Participantes previstos inválido'; end if;
  if jsonb_typeof(v->'orcamento_por_aluno') <> 'number' or (v->>'orcamento_por_aluno') !~ '^\d+$' or (v->>'orcamento_por_aluno')::bigint > 10000000 then raise exception 'Orçamento por aluno inválido'; end if;
  if jsonb_typeof(v->'mensalidade') <> 'number' or (v->>'mensalidade') !~ '^\d+$' or (v->>'mensalidade')::bigint not between 100 and 1000000 then raise exception 'Valor da mensalidade inválido'; end if;
  if jsonb_typeof(v->'parcelas') <> 'number' or (v->>'parcelas') !~ '^\d+$' or (v->>'parcelas')::int not between 1 and 60 then raise exception 'Número de parcelas inválido'; end if;
  if jsonb_typeof(v->'dia_vencimento') <> 'number' or (v->>'dia_vencimento') !~ '^\d+$' or (v->>'dia_vencimento')::int not between 1 and 28 then raise exception 'Dia de vencimento deve ser de 1 a 28'; end if;
  foreach k in array array['adicional_atraso_bp', 'devolucao_desistencia_bp'] loop
    if jsonb_typeof(v->k) <> 'number' or (v->>k) !~ '^\d+$' or (v->>k)::int > 10000 then raise exception 'Percentual inválido em %', k; end if;
  end loop;
  if jsonb_typeof(v->'rendimento_anual_bp') <> 'number' or (v->>'rendimento_anual_bp') !~ '^\d+$' or (v->>'rendimento_anual_bp')::int > 5000 then raise exception 'Rendimento anual deve ficar entre 0%% e 50%%'; end if;
  -- booleanos
  foreach k in array array['novos_pagam_anteriores', 'provisorio'] loop
    if jsonb_typeof(v->k) <> 'boolean' then raise exception 'Valor inválido em %', k; end if;
  end loop;
  -- datas opcionais
  if jsonb_typeof(v->'mes_inicio') <> 'null' and (jsonb_typeof(v->'mes_inicio') <> 'string' or (v->>'mes_inicio') !~ '^20[2-4]\d-(0[1-9]|1[0-2])$') then
    raise exception 'Mês da primeira parcela inválido (use AAAA-MM)';
  end if;
  foreach k in array array['data_ida', 'data_volta'] loop
    if jsonb_typeof(v->k) <> 'null' and (jsonb_typeof(v->k) <> 'string' or (v->>k) !~ '^\d{4}-\d{2}-\d{2}$') then
      raise exception 'Data inválida em %', k;
    end if;
  end loop;
  if jsonb_typeof(v->'data_ida') = 'string' then perform (v->>'data_ida')::date; end if;
  if jsonb_typeof(v->'data_volta') = 'string' then perform (v->>'data_volta')::date; end if;
  if jsonb_typeof(v->'data_ida') = 'string' and jsonb_typeof(v->'data_volta') = 'string'
     and (v->>'data_volta')::date < (v->>'data_ida')::date then
    raise exception 'A volta não pode ser antes da ida';
  end if;
end $$;

-- ---------------------------------------------------------------- tabelas
create table public.config_versions (
  id           bigint generated always as identity primary key,
  valores      jsonb not null,
  alteracoes   jsonb not null default '{}'::jsonb,   -- {"chave": {"de": ..., "para": ...}}
  motivo       text check (motivo is null or length(motivo) <= 500),
  alterado_por uuid references auth.users (id),
  alterado_em  timestamptz not null default now(),
  aprovado_por uuid references auth.users (id),
  aprovado_em  timestamptz,
  proposta_id  bigint
);

create table public.config_proposals (
  id                 bigint generated always as identity primary key,
  base_versao        bigint not null references public.config_versions (id),
  alteracoes         jsonb not null,
  motivo             text not null check (length(trim(motivo)) between 3 and 500),
  status             text not null default 'pendente' check (status in ('pendente', 'aprovada', 'rejeitada', 'cancelada')),
  proposto_por       uuid not null references auth.users (id),
  proposto_em        timestamptz not null default now(),
  decidido_por       uuid references auth.users (id),
  decidido_em        timestamptz,
  observacao_decisao text check (observacao_decisao is null or length(observacao_decisao) <= 500),
  versao_gerada      bigint references public.config_versions (id)
);
-- no máximo uma proposta aguardando aprovação
create unique index config_proposals_uma_pendente on public.config_proposals ((true)) where status = 'pendente';
alter table public.config_versions add constraint config_versions_proposta_fk
  foreign key (proposta_id) references public.config_proposals (id);

alter table public.config_versions enable row level security;
alter table public.config_proposals enable row level security;
create policy "admin e supervisor leem versões" on public.config_versions for select using (public.pode_ler_tudo());
create policy "admin e supervisor leem propostas" on public.config_proposals for select using (public.pode_ler_tudo());
-- gravação só pelas funções (security definer) abaixo
revoke insert, update, delete on public.config_versions, public.config_proposals from anon, authenticated;

-- Cenário inicial do briefing, marcado como provisório. Mês da primeira parcela ainda indefinido.
insert into public.config_versions (valores, motivo)
values (jsonb_build_object(
  'destino', 'Beach Park', 'cidade_destino', 'Aquiraz/CE', 'origem', 'Natal/RN', 'ano', 2028,
  'data_ida', null, 'data_volta', null, 'dias', 4, 'noites', 3, 'alunos_previstos', 20,
  'orcamento_por_aluno', 220000, 'mensalidade', 10000, 'parcelas', 18, 'mes_inicio', null,
  'dia_vencimento', 10, 'adicional_atraso_bp', 1500, 'devolucao_desistencia_bp', 8000,
  'novos_pagam_anteriores', true, 'rendimento_anual_bp', 1200,
  'administrador', 'Davi', 'supervisor', 'Professor(a) responsável', 'provisorio', true
), 'Cenário inicial ilustrativo do briefing (provisório)');

-- ---------------------------------------------------------------- leitura
-- Configuração vigente: aberta a visitantes (parâmetros do projeto, sem dados pessoais).
create or replace function public.configuracao_vigente()
returns jsonb language sql stable security definer set search_path = public as $$
  select valores || jsonb_build_object('_versao', id, '_alterado_em', alterado_em)
  from public.config_versions order by id desc limit 1
$$;
revoke all on function public.configuracao_vigente() from public;
grant execute on function public.configuracao_vigente() to anon, authenticated;

-- ---------------------------------------------------------------- escrita
-- Admin propõe uma configuração completa. Campos gerais entram na hora; regras financeiras
-- viram proposta pendente. Retorna {"versao": id|null, "proposta": id|null}.
create or replace function public.propor_configuracoes(p_valores jsonb, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  atual public.config_versions;
  k text;
  geral jsonb := '{}';
  fin jsonb := '{}';
  nova_versao bigint;
  nova_proposta bigint;
begin
  if not public.e_admin() then
    raise exception 'Só a administração pode alterar as configurações' using errcode = '42501';
  end if;
  if p_motivo is null or length(trim(p_motivo)) < 3 then raise exception 'Explique o motivo da alteração'; end if;
  if length(p_motivo) > 500 then raise exception 'Motivo muito longo (máximo 500 caracteres)'; end if;
  perform public.validar_configuracoes(p_valores);

  select * into atual from public.config_versions order by id desc limit 1 for update;
  foreach k in array public.chaves_configuracao() loop
    if atual.valores->k is distinct from p_valores->k then
      -- decisão do projeto: o admin aplica tudo na hora (regras financeiras inclusive)
      geral := geral || jsonb_build_object(k, jsonb_build_object('de', atual.valores->k, 'para', p_valores->k));
    end if;
  end loop;
  if geral = '{}' and fin = '{}' then raise exception 'Nada foi alterado'; end if;

  if fin <> '{}' and exists (select 1 from public.config_proposals where status = 'pendente') then
    raise exception 'Já existe uma mudança de regra aguardando o professor. Espere a decisão ou cancele a proposta.';
  end if;

  if geral <> '{}' then
    insert into public.config_versions (valores, alteracoes, motivo, alterado_por)
    select atual.valores || jsonb_object_agg(key, value->'para'), geral, trim(p_motivo), auth.uid()
    from jsonb_each(geral)
    returning id into nova_versao;
  end if;

  if fin <> '{}' then
    insert into public.config_proposals (base_versao, alteracoes, motivo, proposto_por)
    values (coalesce(nova_versao, atual.id), fin, trim(p_motivo), auth.uid())
    returning id into nova_proposta;
  end if;

  return jsonb_build_object('versao', nova_versao, 'proposta', nova_proposta);
end $$;

-- Professor aprova ou rejeita a proposta pendente. Na aprovação, só as chaves propostas mudam,
-- e somente se ainda estiverem como estavam quando a proposta foi feita.
create or replace function public.decidir_proposta(p_id bigint, p_aprovar boolean, p_observacao text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  pr public.config_proposals;
  atual public.config_versions;
  novos jsonb;
  k text;
  nova bigint;
begin
  if not public.e_supervisor() then
    raise exception 'Só o professor supervisor pode aprovar ou rejeitar mudanças de regra' using errcode = '42501';
  end if;
  if p_observacao is not null and length(p_observacao) > 500 then raise exception 'Observação muito longa'; end if;
  select * into pr from public.config_proposals where id = p_id for update;
  if pr.id is null then raise exception 'Proposta não encontrada'; end if;
  if pr.status <> 'pendente' then raise exception 'Essa proposta já foi decidida'; end if;

  if not p_aprovar then
    update public.config_proposals
       set status = 'rejeitada', decidido_por = auth.uid(), decidido_em = now(), observacao_decisao = nullif(trim(p_observacao), '')
     where id = p_id;
    return null;
  end if;

  select * into atual from public.config_versions order by id desc limit 1 for update;
  for k in select jsonb_object_keys(pr.alteracoes) loop
    if atual.valores->k is distinct from pr.alteracoes->k->'de' then
      raise exception 'A configuração mudou depois da proposta (campo %). Rejeite e peça uma nova proposta.', k;
    end if;
  end loop;
  select atual.valores || jsonb_object_agg(key, value->'para') into novos from jsonb_each(pr.alteracoes);
  perform public.validar_configuracoes(novos);

  insert into public.config_versions (valores, alteracoes, motivo, alterado_por, aprovado_por, aprovado_em, proposta_id)
  values (novos, pr.alteracoes, pr.motivo, pr.proposto_por, auth.uid(), now(), pr.id)
  returning id into nova;
  update public.config_proposals
     set status = 'aprovada', decidido_por = auth.uid(), decidido_em = now(),
         observacao_decisao = nullif(trim(p_observacao), ''), versao_gerada = nova
   where id = p_id;
  return nova;
end $$;

-- Admin desiste da própria proposta enquanto ela está pendente.
create or replace function public.cancelar_proposta(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.e_admin() then raise exception 'Sem permissão' using errcode = '42501'; end if;
  update public.config_proposals set status = 'cancelada', decidido_por = auth.uid(), decidido_em = now()
   where id = p_id and status = 'pendente';
  if not found then raise exception 'Proposta não encontrada ou já decidida'; end if;
end $$;

revoke all on function public.propor_configuracoes(jsonb, text) from public;
revoke all on function public.decidir_proposta(bigint, boolean, text) from public;
revoke all on function public.cancelar_proposta(bigint) from public;
grant execute on function public.propor_configuracoes(jsonb, text) to authenticated;
grant execute on function public.decidir_proposta(bigint, boolean, text) to authenticated;
grant execute on function public.cancelar_proposta(bigint) to authenticated;
