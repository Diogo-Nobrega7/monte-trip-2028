-- Conferência de lançamentos e saldo bancário (0008). Roda depois de 10 e 20 (mesmos usuários e dados).
\set QUIET on
\set admin 'set role authenticated; select set_config(''request.jwt.claim.sub'', ''a0000000-0000-0000-0000-000000000001'', false);'
\set prof 'set role authenticated; select set_config(''request.jwt.claim.sub'', ''b0000000-0000-0000-0000-000000000002'', false);'
\set visitante 'set role anon; select set_config(''request.jwt.claim.sub'', '''', false);'
\set dono 'reset role; select set_config(''request.jwt.claim.sub'', '''', false);'

-- professor confere um pagamento
:prof
\o /dev/null
insert into public.conferencias (tabela, registro_id, situacao) values ('payments', '9a000000-0000-0000-0000-000000000001', 'conferido');
\o
select t.ok((select conferido_por from public.conferencias order by id desc limit 1) = 'b0000000-0000-0000-0000-000000000002', 'professor confere pagamento e fica registrado quem conferiu');
select t.falha($$insert into public.conferencias (tabela, registro_id, situacao, conferido_por) values ('payments', '9a000000-0000-0000-0000-000000000001', 'conferido', 'a0000000-0000-0000-0000-000000000001')$$, 'ninguém confere em nome de outra pessoa');
select t.falha($$insert into public.conferencias (tabela, registro_id, situacao) values ('expenses', gen_random_uuid(), 'conferido')$$, 'conferência de lançamento inexistente é recusada', 'não encontrado');
select t.falha($$insert into public.conferencias (tabela, registro_id, situacao) values ('expenses', 'e0000000-0000-0000-0000-000000000001', 'divergente')$$, 'divergência sem explicação é recusada', 'check');
select t.falha($$insert into public.saldos_bancarios (data, valor) values (current_date, 100)$$, 'professor não informa saldo bancário');

-- admin marca divergência e depois confere: histórico preservado
:admin
\o /dev/null
insert into public.conferencias (tabela, registro_id, situacao, observacao) values ('expenses', 'e0000000-0000-0000-0000-000000000001', 'divergente', 'Valor no extrato é outro');
insert into public.conferencias (tabela, registro_id, situacao) values ('expenses', 'e0000000-0000-0000-0000-000000000001', 'conferido');
insert into public.saldos_bancarios (data, valor, instituicao) values (current_date, 123456, 'Banco');
\o
select t.ok((select count(*) from public.conferencias where registro_id = 'e0000000-0000-0000-0000-000000000001') = 2, 'divergência e nova conferência ficam no histórico');
select t.ok((select situacao from public.conferencias where registro_id = 'e0000000-0000-0000-0000-000000000001' order by id desc limit 1) = 'conferido', 'situação atual é a conferência mais recente');
select t.falha($$update public.conferencias set situacao = 'conferido'$$, 'conferência não é editada', 'permission denied');
select t.falha($$delete from public.conferencias$$, 'conferência não é apagada', 'permission denied');
select t.falha($$update public.saldos_bancarios set valor = 1$$, 'saldo bancário informado não é editado', 'permission denied');
select t.falha($$delete from public.saldos_bancarios$$, 'saldo bancário informado não é apagado', 'permission denied');
select t.falha($$insert into public.saldos_bancarios (data, valor) values (current_date + 5, 1)$$, 'saldo bancário com data futura é recusado', 'futuro');
select t.ok((select count(*) from public.audit_log where tabela = 'saldos_bancarios') = 1, 'saldo bancário informado fica na auditoria');

-- visitante não vê nada disso
:visitante
select t.ok(t.conta('public.conferencias') = 0 and t.conta('public.saldos_bancarios') = 0, 'visitante não vê conferências nem saldo bancário');
select t.falha($$insert into public.conferencias (tabela, registro_id, situacao) values ('payments', '9a000000-0000-0000-0000-000000000001', 'conferido')$$, 'visitante não confere');
select t.falha($$select public.situacao_parcela('1a000000-0000-0000-0000-00000000000a')$$, 'visitante não consulta situação de parcela', 'permission denied');
select t.falha($$select public.auditar()$$, 'funções internas não são chamáveis pela API', 'permission denied');
:dono
