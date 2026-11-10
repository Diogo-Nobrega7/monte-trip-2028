-- Testes das regras de negócio no banco. Roda depois de 10_permissoes.sql (usa os mesmos usuários).
-- Os mesmos cenários de parcela estão em src/lib/installments.test.ts: os dois lados precisam concordar.
\set QUIET on
\set admin 'set role authenticated; select set_config(''request.jwt.claim.sub'', ''a0000000-0000-0000-0000-000000000001'', false);'
\set prof 'set role authenticated; select set_config(''request.jwt.claim.sub'', ''b0000000-0000-0000-0000-000000000002'', false);'
\set dono 'reset role; select set_config(''request.jwt.claim.sub'', '''', false);'
\o /dev/null

-- ================================================================ configurações
:admin
\o
select t.falha($$select public.propor_configuracoes(public.configuracao_vigente() - '_versao' - '_alterado_em', 'sem mudança')$$, 'proposta sem mudança é recusada', 'Nada foi alterado');
select t.falha($$select public.propor_configuracoes(public.configuracao_vigente() - '_versao' - '_alterado_em' || '{"mensalidade": 100.5}', 'centavos quebrados')$$, 'mensalidade com fração de centavo é recusada', 'mensalidade');
select t.falha($$select public.propor_configuracoes(public.configuracao_vigente() - '_versao' - '_alterado_em' || '{"dia_vencimento": 31}', 'dia 31')$$, 'vencimento depois do dia 28 é recusado', 'Dia de vencimento');
select t.falha($$select public.propor_configuracoes(public.configuracao_vigente() - '_versao' - '_alterado_em' || '{"hacker": 1}', 'campo extra')$$, 'campo desconhecido é recusado', 'desconhecido');
select t.falha($$select public.propor_configuracoes(public.configuracao_vigente() - '_versao' - '_alterado_em' - 'destino', 'campo faltando')$$, 'configuração incompleta é recusada', 'incompleta');
select t.falha($$select public.propor_configuracoes(public.configuracao_vigente() - '_versao' - '_alterado_em' || '{"noites": 9}', 'noites')$$, 'mais noites que dias é recusado', 'Noites');

-- mudança geral entra na hora
select (public.propor_configuracoes(public.configuracao_vigente() - '_versao' - '_alterado_em' || '{"destino": "Fortaleza", "alunos_previstos": 22}', 'Turma decidiu cotar Fortaleza')) as r \gset
select t.ok(:'r'::jsonb->>'versao' is not null and :'r'::jsonb->'proposta' = 'null', 'mudança de destino entra na hora, sem aprovação');
select t.ok(public.configuracao_vigente()->>'destino' = 'Fortaleza', 'configuração vigente mostra o novo destino');
select t.ok((select alteracoes->'destino'->>'de' from public.config_versions order by id desc limit 1) = 'Beach Park', 'histórico guarda o valor anterior');
select t.ok((select alterado_por from public.config_versions order by id desc limit 1) = 'a0000000-0000-0000-0000-000000000001', 'histórico guarda o autor');

-- mudança financeira vira proposta; geral no mesmo envio entra na hora
select (public.propor_configuracoes(public.configuracao_vigente() - '_versao' - '_alterado_em'
  || jsonb_build_object('mensalidade', 12000, 'provisorio', false, 'origem', 'Natal',
       'mes_inicio', to_char(current_date - interval '2 months', 'YYYY-MM')), 'Regras finais combinadas na reunião')) as r \gset
select t.ok(:'r'::jsonb->>'proposta' is not null, 'mudança de mensalidade vira proposta pendente');
select t.ok((public.configuracao_vigente()->>'mensalidade')::int = 10000, 'mensalidade antiga continua valendo até a aprovação');
select t.ok(public.configuracao_vigente()->>'origem' = 'Natal', 'campo geral do mesmo envio entra na hora');
select t.falha($$select public.propor_configuracoes(public.configuracao_vigente() - '_versao' - '_alterado_em' || '{"parcelas": 12}', 'outra')$$, 'só uma proposta pendente por vez', 'aguardando');
select t.falha($$select public.decidir_proposta((select id from public.config_proposals where status = 'pendente'), true)$$, 'admin não aprova a própria proposta', 'professor');
select t.falha($$select public.sincronizar_parcelas()$$, 'parcelas não são geradas com regras provisórias', 'provisórias');

-- professor aprova
:prof
select public.decidir_proposta((select id from public.config_proposals where status = 'pendente'), true, 'Aprovado em reunião') \gset
select t.ok((public.configuracao_vigente()->>'mensalidade')::int = 12000, 'aprovação do professor põe a nova mensalidade em vigor');
select t.ok((public.configuracao_vigente()->>'provisorio')::boolean = false, 'regras deixam de ser provisórias');
select t.ok(public.configuracao_vigente()->>'origem' = 'Natal' and public.configuracao_vigente()->>'destino' = 'Fortaleza', 'aprovação preserva mudanças gerais feitas depois da proposta');
select t.ok((select aprovado_por from public.config_versions order by id desc limit 1) = 'b0000000-0000-0000-0000-000000000002', 'versão aprovada registra quem aprovou');
select t.ok((select status from public.config_proposals order by id desc limit 1) = 'aprovada', 'proposta fica como aprovada');
select t.falha($$select public.decidir_proposta((select max(id) from public.config_proposals), true)$$, 'proposta não é decidida duas vezes', 'já foi decidida');

-- proposta antiga que ficou desatualizada não é aprovada
:admin
select public.propor_configuracoes(public.configuracao_vigente() - '_versao' - '_alterado_em' || '{"devolucao_desistencia_bp": 7000}', 'Teste de rejeição') \gset
:prof
select public.decidir_proposta((select id from public.config_proposals where status = 'pendente'), false, 'Manter 80%') \gset
select t.ok((public.configuracao_vigente()->>'devolucao_desistencia_bp')::int = 8000, 'proposta rejeitada não muda nada');
select t.ok((select observacao_decisao from public.config_proposals order by id desc limit 1) = 'Manter 80%', 'rejeição guarda a observação do professor');

-- ================================================================ geração de parcelas
:admin
select public.sincronizar_parcelas() as g \gset
select t.ok((:'g'::jsonb->>'criadas')::int = 18, 'gera 18 parcelas para o aluno ativo');
select t.ok((select count(*) from public.installments where valor = 12000 and adicional_bp = 1500) = 18, 'parcelas usam a mensalidade e o adicional aprovados');
select t.ok((select vencimento from public.installments where numero = 1) = (date_trunc('month', current_date - interval '2 months') + interval '9 days')::date, 'primeira parcela vence no dia 10 do mês de início');
select t.ok((select vencimento from public.installments where numero = 18) = (date_trunc('month', current_date - interval '2 months') + interval '17 months' + interval '9 days')::date, 'última parcela vence 17 meses depois');
select public.sincronizar_parcelas() as g \gset
select t.ok(:'g'::jsonb = '{"criadas": 0, "removidas": 0, "atualizadas": 0}', 'gerar de novo não duplica nada');

-- professor aprova nova mensalidade: só parcelas futuras sem pagamento mudam
select public.propor_configuracoes(public.configuracao_vigente() - '_versao' - '_alterado_em' || '{"mensalidade": 13000, "parcelas": 16}', 'Reajuste') \gset
:prof
select public.decidir_proposta((select id from public.config_proposals where status = 'pendente'), true) \gset
:admin
select public.sincronizar_parcelas() as g \gset
select t.ok((:'g'::jsonb->>'removidas')::int = 2, 'reduzir para 16 parcelas remove as 2 últimas (sem pagamento)');
select t.ok((select valor from public.installments where numero = 1) = 12000, 'parcela vencida não muda de valor');
select t.ok((select valor from public.installments where numero = 16) = 13000, 'parcela futura sem pagamento recebe o novo valor');

-- ================================================================ situação da parcela
-- Cenários fixos (mesmos de installments.test.ts). Parcelas criadas pelo dono do banco para controlar datas.
:dono
insert into public.students (id, nome, criado_por) values
  ('5b000000-0000-0000-0000-000000000002', 'Aluno Cenários', 'a0000000-0000-0000-0000-000000000001'),
  ('5c000000-0000-0000-0000-000000000003', 'Aluno Distribuição', 'a0000000-0000-0000-0000-000000000001');
insert into public.installments (id, student_id, numero, vencimento, valor, adicional_bp) values
  ('1a000000-0000-0000-0000-00000000000a', '5b000000-0000-0000-0000-000000000002', 1, current_date - 10, 10000, 1500),
  ('1b000000-0000-0000-0000-00000000000b', '5b000000-0000-0000-0000-000000000002', 2, current_date - 10, 10000, 1500),
  ('1c000000-0000-0000-0000-00000000000c', '5b000000-0000-0000-0000-000000000002', 3, current_date + 10, 10000, 1500),
  ('1d000000-0000-0000-0000-00000000000d', '5b000000-0000-0000-0000-000000000002', 4, current_date + 10, 10000, 1500),
  ('1e000000-0000-0000-0000-00000000000e', '5b000000-0000-0000-0000-000000000002', 5, current_date - 10, 10000, 1500),
  ('1f000000-0000-0000-0000-00000000000f', '5b000000-0000-0000-0000-000000000002', 6, current_date - 10, 10001, 1500),
  ('2a000000-0000-0000-0000-00000000000a', '5c000000-0000-0000-0000-000000000003', 1, current_date + 5, 10000, 1500),
  ('2b000000-0000-0000-0000-00000000000b', '5c000000-0000-0000-0000-000000000003', 2, current_date + 35, 10000, 1500),
  ('2c000000-0000-0000-0000-00000000000c', '5c000000-0000-0000-0000-000000000003', 3, current_date + 65, 10000, 1500);
:admin
\o /dev/null
-- A: pago em dia → paga
insert into public.payments (student_id, installment_id, valor, pago_em, metodo, idempotency_key)
  values ('5b000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-00000000000a', 10000, current_date - 11, 'pix', gen_random_uuid());
-- B: 40 pagos no prazo, vencida → adicional sobre os 60 que faltaram
insert into public.payments (student_id, installment_id, valor, pago_em, metodo, idempotency_key)
  values ('5b000000-0000-0000-0000-000000000002', '1b000000-0000-0000-0000-00000000000b', 4000, current_date - 12, 'pix', gen_random_uuid());
-- C: 30 pagos, dentro do prazo → parcial
insert into public.payments (student_id, installment_id, valor, pago_em, metodo, idempotency_key)
  values ('5b000000-0000-0000-0000-000000000002', '1c000000-0000-0000-0000-00000000000c', 3000, current_date, 'pix', gen_random_uuid());
\o
select t.ok((select status = 'paga' and adicional = 0 and restante = 0 from public.situacao_parcela('1a000000-0000-0000-0000-00000000000a')), 'A: paga em dia, sem adicional');
select t.ok((select status = 'atrasada' and adicional = 900 and devido = 10900 and restante = 6900 from public.situacao_parcela('1b000000-0000-0000-0000-00000000000b')), 'B: parcial e vencida → atrasada, adicional de 15% sobre o que faltou (R$ 9,00)');
select t.ok((select status = 'parcial' and adicional = 0 and restante = 7000 from public.situacao_parcela('1c000000-0000-0000-0000-00000000000c')), 'C: parcial dentro do prazo, sem adicional');
select t.ok((select status = 'pendente' and restante = 10000 from public.situacao_parcela('1d000000-0000-0000-0000-00000000000d')), 'D: nada pago, dentro do prazo → pendente');
select t.ok((select status = 'atrasada' and adicional = 1500 and devido = 11500 from public.situacao_parcela('1e000000-0000-0000-0000-00000000000e')), 'E: nada pago e vencida → adicional cheio (R$ 15,00)');
select t.ok((select adicional = 1500 from public.situacao_parcela('1f000000-0000-0000-0000-00000000000f')), 'F: adicional arredonda para o centavo mais próximo (10001 × 15% = 1500,15 → 1500)');
select t.ok((select status = 'parcial' and adicional = 0 from public.situacao_parcela('1b000000-0000-0000-0000-00000000000b', current_date - 10)), 'B no dia do vencimento: parcial, ainda sem adicional');

-- pagamento parcial nunca quita; pagamento a mais é recusado
select t.falha($$insert into public.payments (student_id, installment_id, valor, pago_em, metodo, idempotency_key) values ('5b000000-0000-0000-0000-000000000002', '1d000000-0000-0000-0000-00000000000d', 10001, current_date, 'pix', gen_random_uuid())$$, 'pagamento maior que o saldo da parcela é recusado', 'maior que o saldo');
select t.falha($$insert into public.payments (student_id, installment_id, valor, pago_em, metodo, idempotency_key) values ('5b000000-0000-0000-0000-000000000002', '1e000000-0000-0000-0000-00000000000e', 11501, current_date, 'pix', gen_random_uuid())$$, 'pagamento atrasado não passa do valor + adicional', 'maior que o saldo');
\o /dev/null
insert into public.payments (student_id, installment_id, valor, pago_em, metodo, idempotency_key)
  values ('5b000000-0000-0000-0000-000000000002', '1e000000-0000-0000-0000-00000000000e', 11500, current_date, 'pix', gen_random_uuid());
\o
select t.ok((select status = 'paga' from public.situacao_parcela('1e000000-0000-0000-0000-00000000000e')), 'E quitada com o adicional → paga');
select t.falha($$insert into public.payments (student_id, installment_id, valor, pago_em, metodo, idempotency_key) values ('5a000000-0000-0000-0000-000000000001', '1d000000-0000-0000-0000-00000000000d', 100, current_date, 'pix', gen_random_uuid())$$, 'pagamento não vai para parcela de outro aluno', 'outro aluno');
-- pagamento atrasado de B quitando com adicional: 6900
\o /dev/null
insert into public.payments (id, student_id, installment_id, valor, pago_em, metodo, idempotency_key)
  values ('9b000000-0000-0000-0000-000000000002', '5b000000-0000-0000-0000-000000000002', '1b000000-0000-0000-0000-00000000000b', 6900, current_date, 'pix', gen_random_uuid());
\o
select t.ok((select status = 'paga' and pago = 10900 from public.situacao_parcela('1b000000-0000-0000-0000-00000000000b')), 'B quitada: R$ 40 + R$ 69 = R$ 109');

-- estorno: volta a dever, e pode ser pago de novo
\o /dev/null
insert into public.payments (student_id, installment_id, valor, pago_em, metodo, observacao, estorno_de, idempotency_key)
  values ('5b000000-0000-0000-0000-000000000002', '1b000000-0000-0000-0000-00000000000b', -6900, current_date, 'pix', 'valor errado', '9b000000-0000-0000-0000-000000000002', gen_random_uuid());
\o
select t.ok((select status = 'atrasada' and restante = 6900 from public.situacao_parcela('1b000000-0000-0000-0000-00000000000b')), 'estorno faz a parcela voltar a dever');
select t.falha($$insert into public.payments (student_id, installment_id, valor, pago_em, metodo, estorno_de, idempotency_key) values ('5b000000-0000-0000-0000-000000000002', '1b000000-0000-0000-0000-00000000000b', -6900, current_date, 'pix', '9b000000-0000-0000-0000-000000000002', gen_random_uuid())$$, 'mesmo pagamento não é estornado duas vezes', 'duplicate|unique');
select t.falha($$insert into public.payments (student_id, valor, pago_em, metodo, estorno_de, idempotency_key) values ('5b000000-0000-0000-0000-000000000002', -6900, current_date, 'pix', '1a000000-0000-0000-0000-00000000000a', gen_random_uuid())$$, 'estorno precisa apontar para um pagamento existente');
select t.falha($$insert into public.payments (student_id, valor, pago_em, metodo, idempotency_key) values ('5b000000-0000-0000-0000-000000000002', 100, current_date + 5, 'pix', gen_random_uuid())$$, 'pagamento com data futura é recusado', 'futuro');

-- distribuição automática: mais antiga primeiro
select public.registrar_pagamento_distribuido('5c000000-0000-0000-0000-000000000003', 25000, current_date, 'pix', null, 'cccccccc-0000-0000-0000-000000000001') as n \gset
select t.ok(:n = 3, 'R$ 250 viram 3 pagamentos (100 + 100 + 50)');
select t.ok((select string_agg(status, ',' order by numero) from public.parcelas_situacao where student_id = '5c000000-0000-0000-0000-000000000003') = 'paga,paga,parcial', 'duas parcelas pagas e a terceira parcial');
select t.falha($$select public.registrar_pagamento_distribuido('5c000000-0000-0000-0000-000000000003', 100, current_date, 'pix', null, 'cccccccc-0000-0000-0000-000000000001')$$, 'repetir o mesmo envio é recusado (idempotência)', 'duplicate|unique');
select t.falha($$select public.registrar_pagamento_distribuido('5c000000-0000-0000-0000-000000000003', 5001, current_date, 'pix', null, gen_random_uuid())$$, 'valor acima do total em aberto é recusado', 'passa do total');
select t.ok((select count(*) from public.payments where student_id = '5c000000-0000-0000-0000-000000000003') = 3, 'envio recusado não grava nada pela metade');

-- ================================================================ arrecadações, despesas, rendimentos
select t.ok((select sum(case tipo when 'receita' then valor else -valor end) from public.fundraising_entries) = 38000, 'lucro líquido da ação = receita − custos');
select id as receita_id from public.fundraising_entries where tipo = 'receita' \gset
\o /dev/null
insert into public.fundraising_entries (fundraising_id, tipo, valor, data, descricao, estorno_de, idempotency_key)
  select fundraising_id, 'receita', -valor, current_date, 'Contagem errada', id, gen_random_uuid() from public.fundraising_entries where id = :'receita_id';
\o
select t.ok((select sum(case tipo when 'receita' then valor else -valor end) from public.fundraising_entries) = -12000, 'estorno da receita deixa só os custos');
select t.falha(format($$insert into public.fundraising_entries (fundraising_id, tipo, valor, data, estorno_de, idempotency_key) select fundraising_id, 'custo', -valor, current_date, id, gen_random_uuid() from public.fundraising_entries where id = %L$$, :'receita_id'), 'estorno não troca o tipo do lançamento', 'duplicate|mesmo campo');
select t.falha($$insert into public.expenses (descricao, categoria, data, valor, justificativa, estorno_de, idempotency_key) values ('Sinal', 'agencia', current_date, -2999, 'erro', 'e0000000-0000-0000-0000-000000000001', gen_random_uuid())$$, 'estorno de despesa precisa ter o valor exato', 'valor oposto');
select t.falha($$insert into public.expenses (descricao, categoria, data, valor, justificativa, estorno_de, idempotency_key) values ('Sinal', 'outros', current_date, -3000, 'erro', 'e0000000-0000-0000-0000-000000000001', gen_random_uuid())$$, 'estorno de despesa mantém a categoria', 'mesmo campo');
\o /dev/null
insert into public.expenses (id, descricao, categoria, data, valor, justificativa, estorno_de, idempotency_key)
  values ('e0000000-0000-0000-0000-0000000000e2', 'Sinal', 'agencia', current_date, -3000, 'Pago em duplicidade', 'e0000000-0000-0000-0000-000000000001', gen_random_uuid());
\o
select t.falha($$insert into public.expenses (descricao, categoria, data, valor, justificativa, estorno_de, idempotency_key) values ('Sinal', 'agencia', current_date, 3000, 'x', 'e0000000-0000-0000-0000-0000000000e2', gen_random_uuid())$$, 'estorno de estorno é recusado');
select t.falha($$insert into public.expenses (descricao, categoria, data, valor, justificativa, idempotency_key) values ('x', 'outros', current_date, 0, 'xxx', gen_random_uuid())$$, 'despesa de valor zero é recusada', 'check');
select t.falha($$insert into public.expenses (descricao, categoria, data, valor, justificativa, idempotency_key) values ('Compra', 'outros', current_date, 100, '', gen_random_uuid())$$, 'despesa sem justificativa é recusada', 'justificativa');

-- ================================================================ agências e documentos
select t.ok(public.cnpj_valido('11222333000181') and not public.cnpj_valido('11222333000180') and not public.cnpj_valido('11111111111111'), 'CNPJ confere dígitos verificadores');
select t.falha($$insert into public.agencies (nome, cnpj) values ('X', '11222333000180')$$, 'agência com CNPJ inválido é recusada', 'check');
select t.falha($$insert into public.proposals (agency_id, preco_aluno, servicos) values ('a9000000-0000-0000-0000-000000000001', 1000, '{"piscina": {"incluso": true}}')$$, 'proposta com serviço desconhecido é recusada', 'check');
\o /dev/null
update public.proposals set preco_aluno = 205000, servicos = '{"transporte": {"incluso": true, "detalhe": "Ônibus"}}' where agency_id = 'a9000000-0000-0000-0000-000000000001';
\o
select t.ok((select count(*) from public.audit_log where tabela = 'proposals' and acao = 'UPDATE') = 1, 'edição de proposta fica no histórico');
select t.falha($$insert into public.documents (categoria, titulo, arquivo_path, tipo_mime, tamanho, visibilidade, student_id) values ('autorizacao', 'Autorização', 'autorizacao/44444444-4444-4444-4444-444444444444.pdf', 'application/pdf', 10, 'publico', '5a000000-0000-0000-0000-000000000001')$$, 'documento de aluno nunca é público', 'check');
select t.falha($$insert into public.documents (categoria, titulo, arquivo_path, tipo_mime, tamanho, visibilidade) values ('comprovante', 'Recibo', 'comprovante/44444444-4444-4444-4444-444444444444.pdf', 'application/pdf', 10, 'publico')$$, 'comprovante nunca é público', 'check');
select t.falha($$insert into public.documents (categoria, titulo, arquivo_path, tipo_mime, tamanho) values ('outro', 'Planilha', 'outro/44444444-4444-4444-4444-444444444444.exe', 'application/pdf', 10)$$, 'arquivo com extensão fora da lista é recusado', 'check');
select t.falha($$insert into public.documents (categoria, titulo, arquivo_path, tipo_mime, tamanho) values ('outro', 'Grande', 'outro/44444444-4444-4444-4444-444444444444.pdf', 'application/pdf', 20000000)$$, 'arquivo acima de 10 MB é recusado', 'check');

-- ================================================================ resumo público bate com o livro-caixa
:dono
select t.ok((select saldo from public.resumo_publico()) = (select sum(valor) from public.livro_caixa), 'saldo público = soma do livro-caixa');
select t.ok((select sum(entradas) - sum(saidas) + sum(rendimentos) from public.resumo_publico_mensal()) = (select saldo from public.resumo_publico()), 'totais mensais fecham com o saldo');
select t.ok((select pagamentos from public.resumo_publico()) = (select count(*) from public.payments p where estorno_de is null and not exists (select 1 from public.payments r where r.estorno_de = p.id)), 'contagem pública de pagamentos ignora estornados');
