# Cópia de segurança e recuperação

## O que existe
- **Cópia do sistema (JSON):** em **Configurações → Cópia de segurança → Baixar**. Traz todas as tabelas:
  perfis, histórico de configurações, alunos, parcelas, pagamentos, arrecadações, despesas, rendimentos,
  agências, propostas, registro dos documentos e a auditoria completa. Só admin e professor conseguem gerar.
- **Arquivos anexados (PDF e fotos):** não entram no JSON. Baixe pela página **Documentos** (botão de baixar)
  quando quiser guardar uma cópia.
- **Supabase:** o plano gratuito não garante backup que você consiga baixar. Por isso a cópia JSON é a principal.

## Rotina sugerida
1. Uma vez por mês, e antes de qualquer mudança grande (ex.: aprovar novas regras), baixe a cópia.
2. Guarde em lugar **privado** (tem dados de menores): pasta pessoal no Google Drive/OneDrive, nunca em grupo.
3. Mantenha pelo menos as 3 últimas cópias.
4. Confira de vez em quando: o arquivo abre e tem a data certa em `gerado_em`.

## Como recuperar (projeto novo do zero)
Use quando o projeto Supabase for perdido ou corrompido.

1. Crie um projeto novo no Supabase e rode **todas** as migrações de `supabase/migrations`, em ordem
   (mesmo processo de `docs/PUBLICAR.md`, Parte 1, passos 1 a 5).
2. Recrie as contas (Authentication → Users → Add user) do Davi e do professor. Anote o **id** de cada conta nova
   (aparece na lista de usuários).
3. No computador, com o repositório baixado e o Node instalado, gere o SQL de restauração trocando os ids antigos
   pelos novos (os antigos estão em `tabelas.profiles` dentro do JSON):

   ```
   node scripts/restaurar-backup.mjs monte-trip-backup-AAAA-MM-DD.json \
     --usuario ID-ANTIGO-DAVI=ID-NOVO-DAVI \
     --usuario ID-ANTIGO-PROF=ID-NOVO-PROF > restaurar.sql
   ```
4. Abra `restaurar.sql`, copie tudo, cole no **SQL Editor** do projeto novo e clique **Run**.
   O script roda numa transação: ou entra tudo, ou nada.
5. A última linha mostra os totais (`resumo_publico`). Confira com o último Painel que você viu e com o extrato.
6. Envie de novo os arquivos de Documentos que você tinha baixado (o registro antigo de cada um volta, mas o arquivo não).
7. Atualize as variáveis do GitHub (`VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`) para o projeto novo
   e rode o workflow de publicação.

## Por que é seguro
- A cópia não tem senhas nem chaves: o login fica no Supabase.
- A restauração desliga os gatilhos só durante a carga (os dados já foram validados quando foram gravados)
  e não apaga nada além da configuração inicial que o projeto novo cria.
- Testado: `scripts/e2e` gera uma cópia real e a restauração num banco limpo reproduz os mesmos totais.
