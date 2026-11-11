# Segurança e proteção dos dados

Revisão de 2026-11-11. O que protege o sistema e o que depende de você.

## O que o sistema garante (testado em `scripts/db-test.sh`, 136 verificações)
- **Quem vê o quê é decidido pelo banco (RLS), não pela tela.** Visitante só lê totais (`resumo_publico`),
  configuração vigente e documentos marcados como públicos. Alunos, pagamentos, parcelas, despesas,
  comprovantes, conferências, saldo bancário e auditoria: só admin e professor.
- **Só o admin grava.** O professor lê tudo e pode **conferir** lançamentos (assinando com o próprio usuário).
- **Dinheiro não se apaga nem se edita:** pagamentos, lançamentos de ações, despesas (valor, data e categoria),
  rendimentos, conferências e saldos informados não aceitam UPDATE/DELETE. Correção = estorno.
- **Auditoria:** gatilho grava antes/depois de toda mudança em alunos, parcelas, pagamentos, caixa, agências,
  propostas, documentos e saldos informados. Ninguém escreve na auditoria diretamente.
- **Envio repetido:** cada lançamento tem chave única; clique duplo ou internet caindo não duplicam.
- **Arquivos:** bucket privado; links temporários de 5 minutos; documentos de alunos e comprovantes nunca públicos;
  arquivo de documento ativo não pode ser apagado do Storage.
- **Funções internas** (gatilhos, validações, cálculo de parcela) não podem ser chamadas pela API por visitantes.
- **Sem segredos no site:** só a URL e a chave pública (publishable) vão para o navegador. A chave secreta e a
  senha do banco nunca entram no código nem no GitHub.

## O que depende de você (faça uma vez)
1. **Senhas fortes e únicas** no Supabase, no GitHub e na conta do site.
2. **Verificação em duas etapas (2FA)** no Supabase (Account → Security) e no GitHub (Settings → Password and authentication).
3. **Cadastro aberto desligado** no Supabase: Authentication → Sign In / Providers → Email → "Allow new users to sign up" desligado.
4. **Não compartilhe sua conta.** O professor tem a dele (papel `supervisor`), que só lê e confere.
5. **Tokens:** apague tokens pessoais do Supabase que não usa mais (Account → Access Tokens).
6. **Cópia de segurança mensal** em Configurações, guardada em pasta privada (`docs/BACKUP.md`).
7. **Autorização dos responsáveis** antes de cadastrar dados de cada aluno; guarde em Documentos → Autorizações.

## Rotina mensal sugerida
1. Registrar o rendimento do mês (Prestação de contas → Registrar rendimento).
2. Informar o saldo do extrato (Prestação de contas → Saldos → Informar saldo do extrato) e ver se "bate".
3. Conferir os lançamentos do mês (filtro "A conferir" em Mensalidades e Despesas).
4. Gerar o PDF do fechamento do mês e enviar aos pais e à escola.
5. Baixar a cópia de segurança.
