# Como publicar o site e deixar só o Davi atualizar

Resultado final:
- Um site público, ex.: `https://SEU-USUARIO.github.io/monte-trip-2028/`
- Qualquer pessoa vê **só os totais** (quanto já foi arrecadado, quantos alunos aderiram).
- Só o Davi, logado com e-mail e senha, cadastra alunos e registra pagamentos.
- Nomes e contatos dos alunos nunca ficam públicos.

Quem garante isso é o banco (Supabase), não a tela: mesmo que alguém mexa no código do site,
o banco recusa gravação de quem não é administrador.

Tempo total: uns 20 minutos, uma vez só.

---

## Parte 1 — Banco de dados (Supabase, grátis)

1. Entre em https://supabase.com e crie uma conta (pode ser com o GitHub do Davi).
2. **New project**
   - Nome: `monte-trip-2028`
   - Senha do banco: gere uma forte e guarde num lugar seguro (não vai no site).
   - Região: **South America (São Paulo)**
   - Plano: Free
3. Espere o projeto ficar pronto (1–2 min).
4. Menu lateral → **SQL Editor** → **New query**. Abra o arquivo
   `supabase/migrations/0001_inicial.sql`, copie tudo, cole e clique **Run**.
   Deve aparecer "Success. No rows returned".
   Repita, **um arquivo por vez e nesta ordem**, com `0002_configuracoes.sql`, `0003_mensalidades.sql`,
   `0004_caixa.sql`, `0005_agencias.sql`, `0006_documentos.sql` e `0007_resumo_publico.sql`.
   (Projeto que já rodou a 0001: comece na 0002. Rode cada arquivo uma vez só.)
5. **Bloquear cadastro aberto:** menu **Authentication** → **Sign In / Providers** (ou *Providers*)
   → em **Email**, desligue **Allow new users to sign up** e salve.
   Assim ninguém consegue criar conta sozinho.
6. **Criar a conta do Davi:** **Authentication** → **Users** → **Add user** → **Create new user**.
   Coloque o e-mail e uma senha do Davi e marque **Auto Confirm User**.
7. **Dar papel de administrador:** volte ao **SQL Editor**, nova query, troque o e-mail e rode:

   ```sql
   insert into public.profiles (id, nome, papel)
   select id, 'Davi', 'admin' from auth.users where email = 'EMAIL-DO-DAVI@exemplo.com';
   ```

   Deve aparecer "Success. 1 row". Se aparecer "0 rows", o e-mail está diferente do passo 6.

   (Opcional) Professor supervisor, só leitura: crie o usuário no passo 6 e rode o mesmo comando trocando
   `'Davi', 'admin'` por `'Nome do professor', 'supervisor'`. Ele vê tudo e não altera nada.
8. Pegue as chaves: **Project Settings** → **API Keys** (ou **Data API**). Copie:
   - **Project URL** (ex.: `https://abcd1234.supabase.co`)
   - **Publishable key** (começa com `sb_publishable_`). Se só aparecer "anon public", use essa.

   **Nunca** use a `secret` / `service_role` key nem a senha do banco no site.

---

## Parte 2 — GitHub

1. Crie uma conta no https://github.com (o ideal é a conta ser do Davi).
2. **New repository** → nome `monte-trip-2028` → **Public** → *não* marque README → **Create**.
3. Envie esta pasta para o repositório. Pelo terminal, dentro da pasta `monte-trip-2028`:

   ```
   git init -b main
   git add .
   git commit -m "Primeira versão"
   git remote add origin https://github.com/SEU-USUARIO/monte-trip-2028.git
   git push -u origin main
   ```

   (Sem terminal: na página do repositório vazio, use **uploading an existing file** e arraste
   o conteúdo da pasta, **exceto** `node_modules` e `.env.local`.)
4. No repositório: **Settings** → **Secrets and variables** → **Actions** → aba **Variables**
   → **New repository variable**, duas vezes:
   - `VITE_SUPABASE_URL` = Project URL da Parte 1
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = publishable key da Parte 1
5. **Settings** → **Pages** → em **Source**, escolha **GitHub Actions**.
6. Aba **Actions** → **Publicar no GitHub Pages** → **Run workflow** (ou faça qualquer push).
   Em 1–2 minutos o site aparece em **Settings → Pages**.

Só quem tem permissão de escrita no repositório consegue mudar o site. Não adicione colaboradores
que não precisam.

---

## Atualizar um site que já está no ar

Quando chegar uma versão nova com migrações novas em `supabase/migrations`:
1. **Primeiro o banco:** rode no SQL Editor só os arquivos novos, em ordem.
2. **Depois o site:** junte o ramo na `main` (o GitHub publica sozinho).

Nessa ordem o site antigo continua funcionando enquanto o banco é atualizado. Na ordem inversa, o site novo
ficaria procurando tabelas que ainda não existem.

---

## Parte 3 — Uso no dia a dia (Davi)

Primeira vez:
1. **Entrar** (menu do usuário, no canto de baixo da barra lateral, ou `.../#entrar`). Funciona pelo celular.
2. **Alunos** → **Importar planilha** (Excel ou CSV com coluna "Nome") ou **Cadastrar aluno** um a um.
3. **Configurações** → **Editar**: confira valores, defina o **mês da primeira parcela**, desmarque
   "Regras ainda provisórias" quando estiverem fechadas e escreva o motivo. Vale na hora e fica no histórico.
4. **Mensalidades** → **Gerar parcelas**.

Quando um aluno mandar dinheiro: **Mensalidades** → **Registrar pagamento** → aluno, valor, data, forma.
Por padrão o valor quita as parcelas em aberto da mais antiga para a mais nova (dá para escolher uma parcela
específica ou registrar como avulso). Pagamento menor que a parcela fica como **Parcial**; depois do
vencimento entra o adicional por atraso.

Outras rotinas:
- Ações (bazar, evento, patrocínio): **Arrecadações** → receita e custos; comprovantes em **Lançamentos**.
- Gastos: **Despesas**, sempre com justificativa e comprovante (PDF ou foto).
- Rendimento da aplicação: **Prestação de contas** → **Registrar rendimento**, copiando do extrato.
- Prestação de contas para pais e escola: **Prestação de contas** → período → **Gerar PDF** ou CSV.
- Uma vez por mês: **Configurações** → **Baixar cópia de segurança** (ver `docs/BACKUP.md`).

Errou um lançamento? Clique **Estornar** e escreva o motivo. O original fica no histórico e o valor é
descontado. Depois registre o certo. Vale para pagamentos, arrecadações, despesas e rendimentos.

Aluno desistiu? Em **Alunos**, clique **Desistiu**: a tela mostra a devolução prevista pela regra vigente.
Ao devolver, registre em Despesas, categoria "Devolução a desistente".

---

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Site mostra "Modo demonstração" | Variáveis da Parte 2, passo 4, faltando ou com nome errado. Rode o workflow de novo depois de corrigir. |
| "E-mail ou senha incorretos" | Conferir o usuário em Authentication → Users. Dá para trocar a senha lá. |
| Entra, mas não aparece botão de registrar | Faltou o passo 7 da Parte 1 (papel admin). |
| "Não foi possível carregar a configuração" | Faltou rodar as migrações 0002 a 0007. |
| "Gerar parcelas" diz que as regras estão provisórias | Desmarque "Regras ainda provisórias" em Configurações. |
| Envio de arquivo dá "Sem permissão" | Faltou a migração 0006 (cria o bucket privado e as regras do Storage). |
| "Sem permissão" ao salvar | Mesmo caso acima. |
| Workflow falha no GitHub | Aba Actions → abrir a execução → ver o passo em vermelho. |
