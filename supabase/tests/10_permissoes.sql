-- Testes de permissão (RLS). Rodados por scripts/db-test.sh num banco local descartável.
-- Cada linha "ok" é uma regra conferida; qualquer falha interrompe com "FALHOU".
\set QUIET on
set client_min_messages = notice;

-- ---------------------------------------------------------------- utilitários
create schema t;
grant usage on schema t to anon, authenticated;
create function t.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if c is not true then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok   %', msg;
end $$;
-- Executa o SQL e exige que dê erro (opcionalmente com a mensagem esperada).
create function t.falha(cmd text, msg text, padrao text default null) returns void language plpgsql as $$
begin
  begin
    execute cmd;
  exception when others then
    if padrao is null or sqlerrm ~* padrao then raise notice 'ok   % [%]', msg, sqlerrm; return; end if;
    raise exception 'FALHOU: % — erro inesperado: %', msg, sqlerrm;
  end;
  raise exception 'FALHOU: % — deveria ter sido recusado', msg;
end $$;
-- Conta linhas visíveis para o papel atual.
create function t.conta(tabela text) returns bigint language plpgsql as $$
declare n bigint; begin execute format('select count(*) from %s', tabela) into n; return n; end $$;
grant execute on all functions in schema t to anon, authenticated;

-- usuários: admin (Davi), supervisor (professor), alguém logado sem papel
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'davi@teste'),
  ('b0000000-0000-0000-0000-000000000002', 'prof@teste'),
  ('c0000000-0000-0000-0000-000000000003', 'estranho@teste');
insert into public.profiles (id, nome, papel) values
  ('a0000000-0000-0000-0000-000000000001', 'Davi', 'admin'),
  ('b0000000-0000-0000-0000-000000000002', 'Professor', 'supervisor');

\set admin 'set role authenticated; select set_config(''request.jwt.claim.sub'', ''a0000000-0000-0000-0000-000000000001'', false);'
\set prof 'set role authenticated; select set_config(''request.jwt.claim.sub'', ''b0000000-0000-0000-0000-000000000002'', false);'
\set estranho 'set role authenticated; select set_config(''request.jwt.claim.sub'', ''c0000000-0000-0000-0000-000000000003'', false);'
\set visitante 'set role anon; select set_config(''request.jwt.claim.sub'', '''', false);'
\set dono 'reset role; select set_config(''request.jwt.claim.sub'', '''', false);'

-- ---------------------------------------------------------------- admin grava
:admin
\o /dev/null
insert into public.students (id, nome, responsavel_nome) values ('5a000000-0000-0000-0000-000000000001', 'Aluno Teste', 'Responsável Teste');
insert into public.payments (id, student_id, valor, pago_em, metodo, idempotency_key)
  values ('9a000000-0000-0000-0000-000000000001', '5a000000-0000-0000-0000-000000000001', 10000, current_date, 'pix', gen_random_uuid());
insert into public.expenses (id, descricao, categoria, data, valor, justificativa, idempotency_key)
  values ('e0000000-0000-0000-0000-000000000001', 'Sinal', 'agencia', current_date, 3000, 'Reserva de datas', gen_random_uuid());
insert into public.yields (data, valor, instituicao, idempotency_key) values (current_date, 150, 'Banco', gen_random_uuid());
select public.registrar_arrecadacao('Bazar', 'venda', current_date, 'Turma', null, 50000, 12000, gen_random_uuid());
insert into public.agencies (id, nome) values ('a9000000-0000-0000-0000-000000000001', 'Agência Teste');
insert into public.proposals (agency_id, preco_aluno) values ('a9000000-0000-0000-0000-000000000001', 210000);
insert into public.documents (id, categoria, titulo, arquivo_path, tipo_mime, tamanho, visibilidade)
  values ('d0000000-0000-0000-0000-000000000001', 'regulamento', 'Regulamento', 'regulamento/11111111-1111-1111-1111-111111111111.pdf', 'application/pdf', 1000, 'publico'),
         ('d0000000-0000-0000-0000-000000000002', 'autorizacao', 'Autorização', 'autorizacao/22222222-2222-2222-2222-222222222222.pdf', 'application/pdf', 1000, 'gestao');
insert into storage.objects (bucket_id, name) values
  ('documentos', 'regulamento/11111111-1111-1111-1111-111111111111.pdf'),
  ('documentos', 'autorizacao/22222222-2222-2222-2222-222222222222.pdf');
\o
select t.ok(true, 'admin cadastra aluno, pagamento, despesa, rendimento, ação, agência, proposta e documentos');
select t.ok(t.conta('public.students') = 1 and t.conta('public.payments') = 1, 'admin lê alunos e pagamentos');
select t.ok(t.conta('public.livro_caixa') = 5, 'admin lê o livro-caixa completo');
select t.falha($$insert into storage.objects (bucket_id, name) values ('documentos', 'qualquer/x.pdf')$$, 'admin não envia arquivo fora das pastas de categoria');

-- ---------------------------------------------------------------- visitante (não logado)
:visitante
select t.ok(t.conta('public.students') = 0, 'visitante não vê alunos');
select t.ok(t.conta('public.payments') = 0, 'visitante não vê pagamentos');
select t.ok(t.conta('public.installments') = 0, 'visitante não vê parcelas');
select t.ok(t.conta('public.expenses') = 0, 'visitante não vê despesas');
select t.ok(t.conta('public.fundraisings') = 0 and t.conta('public.fundraising_entries') = 0, 'visitante não vê arrecadações detalhadas');
select t.ok(t.conta('public.yields') = 0, 'visitante não vê rendimentos detalhados');
select t.ok(t.conta('public.livro_caixa') = 0, 'visitante não vê o livro-caixa');
select t.ok(t.conta('public.agencies') = 0 and t.conta('public.proposals') = 0, 'visitante não vê agências nem propostas');
select t.ok(t.conta('public.audit_log') = 0, 'visitante não vê a auditoria');
select t.ok(t.conta('public.config_versions') = 0 and t.conta('public.config_proposals') = 0, 'visitante não vê o histórico de configurações');
select t.ok(t.conta('public.profiles') = 0, 'visitante não vê perfis');
select t.ok(t.conta('public.documents') = 1, 'visitante vê só o documento público');
select t.ok(t.conta('storage.objects') = 1, 'visitante só acessa o arquivo público');
select t.ok((select total_arrecadado from public.resumo_publico()) = 10000, 'visitante vê o total arrecadado');
select t.ok((select saldo from public.resumo_publico()) = 10000 + 50000 - 12000 - 3000 + 150, 'visitante vê o saldo geral');
select t.ok((select count(*) from public.resumo_publico_mensal()) = 1, 'visitante vê totais mensais');
select t.ok((public.configuracao_vigente()->>'destino') = 'Beach Park', 'visitante lê a configuração vigente');
select t.falha($$insert into public.students (nome) values ('Invasor')$$, 'visitante não cadastra aluno');
select t.falha($$insert into public.payments (student_id, valor, pago_em, metodo, idempotency_key, registrado_por) values ('5a000000-0000-0000-0000-000000000001', 1, current_date, 'pix', gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001')$$, 'visitante não registra pagamento');
select t.falha($$select public.propor_configuracoes(public.configuracao_vigente() - '_versao' - '_alterado_em', 'teste')$$, 'visitante não altera configurações');
select t.falha($$select public.sincronizar_parcelas()$$, 'visitante não gera parcelas');
select t.falha($$insert into storage.objects (bucket_id, name) values ('documentos', 'regulamento/33333333-3333-3333-3333-333333333333.pdf')$$, 'visitante não envia arquivos');

-- ---------------------------------------------------------------- logado sem papel
:estranho
select t.ok(t.conta('public.students') = 0 and t.conta('public.payments') = 0, 'conta sem papel não vê alunos nem pagamentos');
select t.falha($$insert into public.students (nome) values ('Invasor')$$, 'conta sem papel não cadastra aluno');
select t.falha($$insert into public.expenses (descricao, categoria, data, valor, justificativa, idempotency_key) values ('x', 'outros', current_date, 1, 'xxx', gen_random_uuid())$$, 'conta sem papel não registra despesa');
select t.falha($$insert into public.profiles (id, nome, papel) values ('c0000000-0000-0000-0000-000000000003', 'Eu', 'admin')$$, 'ninguém se promove a admin');

-- ---------------------------------------------------------------- supervisor (professor)
:prof
select t.ok(t.conta('public.students') = 1 and t.conta('public.payments') = 1 and t.conta('public.expenses') = 1, 'professor lê alunos, pagamentos e despesas');
select t.ok(t.conta('public.documents') = 2 and t.conta('storage.objects') = 2, 'professor vê todos os documentos');
select t.ok(t.conta('public.audit_log') > 0, 'professor lê a auditoria');
select t.falha($$insert into public.students (nome) values ('Pelo professor')$$, 'professor não cadastra aluno');
select t.falha($$insert into public.payments (student_id, valor, pago_em, metodo, idempotency_key) values ('5a000000-0000-0000-0000-000000000001', 100, current_date, 'pix', gen_random_uuid())$$, 'professor não registra pagamento');
select t.falha($$insert into public.expenses (descricao, categoria, data, valor, justificativa, idempotency_key) values ('x', 'outros', current_date, 1, 'xxx', gen_random_uuid())$$, 'professor não registra despesa');
select t.falha($$select public.propor_configuracoes(public.configuracao_vigente() - '_versao' - '_alterado_em', 'teste')$$, 'professor não propõe configurações', 'administração');
select t.falha($$select public.excluir_documento('d0000000-0000-0000-0000-000000000001', 'teste')$$, 'professor não exclui documentos');
update public.students set nome = 'Mudado' where true;
select t.ok((select nome from public.students) = 'Aluno Teste', 'professor não altera alunos');

-- ---------------------------------------------------------------- imutabilidade (vale até para o admin)
:admin
select t.falha($$update public.payments set valor = 1$$, 'ninguém edita pagamento', 'permission denied');
select t.falha($$delete from public.payments$$, 'ninguém apaga pagamento', 'permission denied');
select t.falha($$update public.expenses set valor = 1$$, 'ninguém edita o valor da despesa', 'permission denied');
select t.falha($$update public.expenses set data = current_date - 1$$, 'ninguém edita a data da despesa', 'permission denied');
select t.falha($$delete from public.expenses$$, 'ninguém apaga despesa', 'permission denied');
select t.falha($$update public.fundraising_entries set valor = 1$$, 'ninguém edita lançamento de ação', 'permission denied');
select t.falha($$delete from public.yields$$, 'ninguém apaga rendimento', 'permission denied');
select t.falha($$delete from public.students$$, 'ninguém apaga aluno', 'permission denied');
select t.falha($$insert into public.audit_log (tabela, registro_id, acao) values ('x', gen_random_uuid(), 'x')$$, 'ninguém escreve na auditoria', 'permission denied');
select t.falha($$insert into public.config_versions (valores) values ('{}')$$, 'ninguém grava configuração direto na tabela', 'permission denied');
select t.falha($$insert into public.installments (student_id, numero, vencimento, valor, adicional_bp) values ('5a000000-0000-0000-0000-000000000001', 1, current_date, 1, 0)$$, 'parcela só nasce pela geração automática', 'permission denied');
select t.falha($$update public.documents set excluido_em = now()$$, 'documento só é excluído pela função', 'permission denied');
delete from storage.objects where bucket_id = 'documentos';
select t.ok((select count(*) from storage.objects) = 2, 'arquivo de documento ativo não pode ser apagado do Storage');
update public.expenses set justificativa = 'Reserva das datas no hotel' where id = 'e0000000-0000-0000-0000-000000000001';
select t.ok((select justificativa from public.expenses) = 'Reserva das datas no hotel', 'admin corrige a justificativa da despesa');
select t.ok((select count(*) from public.audit_log where tabela = 'expenses' and acao = 'UPDATE') = 1, 'correção de despesa fica na auditoria');

-- exclusão controlada de documento
select public.excluir_documento('d0000000-0000-0000-0000-000000000002', 'Enviado por engano') \gset
delete from storage.objects where name = 'autorizacao/22222222-2222-2222-2222-222222222222.pdf';
select t.ok((select count(*) from storage.objects) = 1, 'arquivo de documento excluído pode ser apagado');
select t.ok((select motivo_exclusao from public.documents where id = 'd0000000-0000-0000-0000-000000000002') = 'Enviado por engano', 'registro do documento excluído fica guardado com o motivo');

:dono
