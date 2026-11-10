-- Monte Trip 2028 — parcelas (mensalidades) e pagamentos vinculados.
-- Rodar depois de 0002_configuracoes.sql.
--
-- Regras (mesmas de src/lib/installments.ts, cobertas por testes nos dois lados):
--   * Cada aluno ativo recebe N parcelas com o valor, o vencimento e o adicional da configuração vigente.
--   * Uma parcela guarda o valor e o percentual de adicional da época em que foi gerada.
--   * Situação calculada a partir dos pagamentos não estornados:
--       pago no prazo  = soma dos pagamentos com data <= vencimento
--       adicional      = se a data de referência passou do vencimento e faltou dinheiro no prazo:
--                        arredonda((valor − pago no prazo) × adicional_bp / 10000), cobrado uma vez
--       devido         = valor + adicional
--       paga           = pago >= devido
--       atrasada       = não paga e referência > vencimento
--       parcial        = não paga, dentro do prazo, pago > 0
--       pendente       = nada pago, dentro do prazo
--   * Um pagamento não pode passar do que falta na parcela (nunca vira "paga" com pagamento parcial
--     e nunca recebe a mais sem registro).

-- Centavos → "1234,56" para mensagens de erro.
create or replace function public.formatar_reais(c bigint)
returns text language sql immutable as $$ select replace(to_char(c / 100.0, 'FM999999990.00'), '.', ',') $$;

-- ---------------------------------------------------------------- parcelas
create table public.installments (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students (id),
  numero        int not null check (numero between 1 and 60),
  vencimento    date not null,
  valor         bigint not null check (valor between 1 and 10000000),
  adicional_bp  int not null check (adicional_bp between 0 and 10000),
  config_versao bigint references public.config_versions (id),
  criada_em     timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  unique (student_id, numero)
);
create index installments_vencimento_idx on public.installments (vencimento);

alter table public.installments enable row level security;
create policy "admin e supervisor leem parcelas" on public.installments for select using (public.pode_ler_tudo());
-- parcelas só mudam pela função sincronizar_parcelas()
revoke insert, update, delete on public.installments from anon, authenticated;

create trigger installments_audit after insert or update or delete on public.installments
  for each row execute function public.auditar();

-- ---------------------------------------------------------------- pagamentos ↔ parcelas
alter table public.payments add column installment_id uuid references public.installments (id);
create index payments_installment_idx on public.payments (installment_id);

-- Situação de uma parcela numa data de referência (ver regras no topo).
create or replace function public.situacao_parcela(p_id uuid, p_ref date default current_date)
returns table (valor bigint, adicional bigint, devido bigint, pago bigint, restante bigint, status text)
language plpgsql stable set search_path = public as $$
declare
  i public.installments;
  no_prazo bigint;
  total bigint;
  adic bigint := 0;
begin
  select * into i from public.installments where id = p_id;
  if i.id is null then raise exception 'Parcela não encontrada'; end if;
  -- pagamentos válidos: positivos e não estornados
  select coalesce(sum(p.valor) filter (where p.pago_em <= i.vencimento), 0), coalesce(sum(p.valor), 0)
    into no_prazo, total
    from public.payments p
   where p.installment_id = i.id and p.estorno_de is null
     and not exists (select 1 from public.payments r where r.estorno_de = p.id);
  if p_ref > i.vencimento and no_prazo < i.valor then
    adic := ((i.valor - no_prazo) * i.adicional_bp + 5000) / 10000;
  end if;
  valor := i.valor; adicional := adic; devido := i.valor + adic; pago := total;
  restante := greatest(0, i.valor + adic - total);
  status := case when total >= i.valor + adic then 'paga'
                 when p_ref > i.vencimento then 'atrasada'
                 when total > 0 then 'parcial'
                 else 'pendente' end;
  return next;
end $$;

-- Substitui a validação de 0001: além do estorno, confere parcela, aluno e saldo da parcela.
-- security definer: precisa travar a parcela (select ... for update) mesmo sem permissão de alterá-la.
-- Só lê e confere; quem pode inserir o pagamento continua sendo decidido pelo RLS de payments.
create or replace function public.validar_estorno()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  o public.payments;
  i public.installments;
  no_prazo bigint;
  total bigint;
  adic bigint := 0;
  ref date;
begin
  if new.pago_em > current_date + 1 then raise exception 'Data de pagamento no futuro'; end if;

  if new.estorno_de is not null then
    select * into o from public.payments where id = new.estorno_de;
    if o.id is null then raise exception 'Pagamento original não encontrado'; end if;
    if o.estorno_de is not null then raise exception 'Não é possível estornar um estorno'; end if;
    if new.student_id <> o.student_id or new.valor <> -o.valor then
      raise exception 'Estorno deve ter o mesmo aluno e o valor oposto ao original';
    end if;
    if new.installment_id is distinct from o.installment_id then
      raise exception 'Estorno deve apontar para a mesma parcela do original';
    end if;
    return new;
  end if;

  if new.installment_id is null then return new; end if;
  -- trava a parcela: dois pagamentos ao mesmo tempo não passam juntos do saldo
  select * into i from public.installments where id = new.installment_id for update;
  if i.id is null then raise exception 'Parcela não encontrada'; end if;
  if i.student_id <> new.student_id then raise exception 'A parcela é de outro aluno'; end if;

  select coalesce(sum(p.valor) filter (where p.pago_em <= i.vencimento), 0), coalesce(sum(p.valor), 0)
    into no_prazo, total
    from public.payments p
   where p.installment_id = i.id and p.estorno_de is null
     and not exists (select 1 from public.payments r where r.estorno_de = p.id);
  if new.pago_em <= i.vencimento then no_prazo := no_prazo + new.valor; end if;
  total := total + new.valor;
  ref := greatest(current_date, new.pago_em);
  if ref > i.vencimento and no_prazo < i.valor then
    adic := ((i.valor - no_prazo) * i.adicional_bp + 5000) / 10000;
  end if;
  if total > i.valor + adic then
    raise exception 'Valor maior que o saldo da parcela % (faltam R$ %)', i.numero,
      public.formatar_reais(i.valor + adic - (total - new.valor));
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- geração das parcelas
-- Cria as parcelas que faltam para cada aluno ativo e atualiza as FUTURAS que ainda não receberam
-- nenhum pagamento (ex.: o professor aprovou outro valor). Parcelas vencidas ou com pagamento
-- nunca mudam. Retorna {"criadas", "atualizadas", "removidas"}.
create or replace function public.sincronizar_parcelas()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cfg jsonb;
  versao bigint;
  s record;
  n int;
  venc date;
  inicio date;
  criadas int := 0;
  atualizadas int := 0;
  removidas int := 0;
  r record;
  c int;
begin
  if not public.e_admin() then raise exception 'Sem permissão' using errcode = '42501'; end if;
  select valores, id into cfg, versao from public.config_versions order by id desc limit 1;
  if (cfg->>'provisorio')::boolean then
    raise exception 'As regras ainda estão marcadas como provisórias. O professor precisa aprovar as regras definitivas em Configurações antes de gerar as parcelas.';
  end if;
  if cfg->>'mes_inicio' is null then raise exception 'Defina o mês da primeira parcela em Configurações'; end if;
  inicio := to_date(cfg->>'mes_inicio' || '-01', 'YYYY-MM-DD');

  for s in select id, adesao_em, status from public.students order by nome loop
    -- removidas: parcelas futuras sem pagamento que deixaram de existir pelas regras
    with alvo as (
      select i.id from public.installments i
       where i.student_id = s.id and i.vencimento >= current_date
         and not exists (select 1 from public.payments p where p.installment_id = i.id)
         and (s.status <> 'ativo'
              or i.numero > (cfg->>'parcelas')::int
              or (not (cfg->>'novos_pagam_anteriores')::boolean
                  and (inicio + make_interval(months => i.numero - 1)) < date_trunc('month', s.adesao_em)))
    )
    delete from public.installments i using alvo where i.id = alvo.id;
    get diagnostics c = row_count; removidas := removidas + c;

    continue when s.status <> 'ativo';

    for n in 1 .. (cfg->>'parcelas')::int loop
      venc := (inicio + make_interval(months => n - 1))::date + ((cfg->>'dia_vencimento')::int - 1);
      continue when not (cfg->>'novos_pagam_anteriores')::boolean
                    and date_trunc('month', venc) < date_trunc('month', s.adesao_em);
      insert into public.installments as i (student_id, numero, vencimento, valor, adicional_bp, config_versao)
      values (s.id, n, venc, (cfg->>'mensalidade')::bigint, (cfg->>'adicional_atraso_bp')::int, versao)
      on conflict (student_id, numero) do update
         set vencimento = excluded.vencimento, valor = excluded.valor, adicional_bp = excluded.adicional_bp,
             config_versao = excluded.config_versao, atualizada_em = now()
       where i.vencimento >= current_date and excluded.vencimento >= current_date
         and not exists (select 1 from public.payments p where p.installment_id = i.id)
         and (i.vencimento, i.valor, i.adicional_bp) is distinct from (excluded.vencimento, excluded.valor, excluded.adicional_bp)
      returning (xmax = 0) as nova into r;
      if found then
        if r.nova then criadas := criadas + 1; else atualizadas := atualizadas + 1; end if;
      end if;
    end loop;
  end loop;
  return jsonb_build_object('criadas', criadas, 'atualizadas', atualizadas, 'removidas', removidas);
end $$;
revoke all on function public.sincronizar_parcelas() from public;
grant execute on function public.sincronizar_parcelas() to authenticated;

-- ---------------------------------------------------------------- pagamento distribuído
-- Registra um valor do aluno quitando as parcelas em aberto da mais antiga para a mais nova.
-- Roda com as permissões de quem chama (RLS vale). Cada parte vira um pagamento próprio,
-- todos com chaves derivadas da mesma chave de idempotência: repetir o envio é recusado.
create or replace function public.registrar_pagamento_distribuido(
  p_student uuid, p_valor bigint, p_pago_em date, p_metodo text, p_observacao text, p_chave uuid
) returns int language plpgsql security invoker set search_path = public as $$
declare
  resto bigint := p_valor;
  i record;
  sit record;
  parte bigint;
  n int := 0;
begin
  if p_valor is null or p_valor <= 0 then raise exception 'Valor inválido'; end if;
  for i in select id, numero from public.installments where student_id = p_student order by vencimento, numero loop
    exit when resto = 0;
    select * into sit from public.situacao_parcela(i.id, greatest(current_date, p_pago_em));
    -- o adicional depende de o próprio pagamento chegar no prazo; o gatilho confere o valor exato
    if p_pago_em <= (select vencimento from public.installments where id = i.id) then
      select * into sit from public.situacao_parcela(i.id, (select vencimento from public.installments where id = i.id));
    end if;
    continue when sit.restante = 0;
    parte := least(resto, sit.restante);
    insert into public.payments (student_id, installment_id, valor, pago_em, metodo, observacao, idempotency_key)
    values (p_student, i.id, parte, p_pago_em, p_metodo,
            coalesce(nullif(trim(p_observacao), ''), 'Parcela ' || i.numero),
            case when n = 0 then p_chave else md5(p_chave::text || ':' || n)::uuid end);
    resto := resto - parte;
    n := n + 1;
  end loop;
  if resto > 0 then
    raise exception 'O valor passa do total em aberto do aluno em R$ %. Registre a diferença como pagamento avulso.',
      public.formatar_reais(resto);
  end if;
  return n;
end $$;
revoke all on function public.registrar_pagamento_distribuido(uuid, bigint, date, text, text, uuid) from public;
grant execute on function public.registrar_pagamento_distribuido(uuid, bigint, date, text, text, uuid) to authenticated;
