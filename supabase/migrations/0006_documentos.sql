-- Monte Trip 2028 — documentos e comprovantes (Supabase Storage).
-- Rodar depois de 0005_agencias.sql.
--
-- Regras:
--   * Arquivos ficam no bucket PRIVADO "documentos" (PDF e imagens, até 10 MB).
--   * Por padrão, só admin e supervisor veem. Apenas Regulamento e Relatórios podem ser marcados
--     como públicos; documentos ligados a um aluno nunca são públicos.
--   * Excluir não apaga o registro: ele fica com data, autor e motivo da exclusão (auditoria).
--     O arquivo em si só pode ser removido depois que o registro foi marcado como excluído.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.documents (
  id              uuid primary key default gen_random_uuid(),
  categoria       text not null check (categoria in ('regulamento', 'autorizacao', 'contrato', 'comprovante', 'relatorio', 'proposta', 'outro')),
  titulo          text not null check (length(trim(titulo)) between 2 and 160),
  arquivo_path    text not null unique check (arquivo_path ~ '^[a-z]+/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$'),
  nome_original   text check (nome_original is null or length(nome_original) <= 200),
  tipo_mime       text not null check (tipo_mime in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  tamanho         bigint not null check (tamanho between 1 and 10485760),
  visibilidade    text not null default 'gestao' check (visibilidade in ('gestao', 'publico')),
  student_id      uuid references public.students (id),
  expense_id      uuid references public.expenses (id),
  fundraising_id  uuid references public.fundraisings (id),
  proposal_id     uuid references public.proposals (id),
  enviado_por     uuid not null default auth.uid() references auth.users (id),
  enviado_em      timestamptz not null default now(),
  excluido_em     timestamptz,
  excluido_por    uuid references auth.users (id),
  motivo_exclusao text check (motivo_exclusao is null or length(motivo_exclusao) <= 300),
  -- só regulamento e relatórios podem ser públicos, e nunca se forem de um aluno ou de um lançamento
  check (visibilidade = 'gestao' or (categoria in ('regulamento', 'relatorio')
         and student_id is null and expense_id is null and fundraising_id is null and proposal_id is null)),
  -- no máximo um vínculo por documento
  check (num_nonnulls(student_id, expense_id, fundraising_id, proposal_id) <= 1),
  check ((excluido_em is null) = (excluido_por is null))
);
create index documents_expense_idx on public.documents (expense_id) where excluido_em is null;
create index documents_fundraising_idx on public.documents (fundraising_id) where excluido_em is null;
create index documents_proposal_idx on public.documents (proposal_id) where excluido_em is null;

create trigger documents_audit after insert or update or delete on public.documents
  for each row execute function public.auditar();

alter table public.documents enable row level security;
create policy "gestão lê documentos; todos leem os públicos" on public.documents for select
  using (public.pode_ler_tudo() or (visibilidade = 'publico' and excluido_em is null));
create policy "admin registra documentos" on public.documents for insert
  with check (public.e_admin() and enviado_por = auth.uid() and excluido_em is null);
-- exclusão e mudanças só pela função abaixo
revoke update, delete on public.documents from anon, authenticated;

create or replace function public.excluir_documento(p_id uuid, p_motivo text)
returns text language plpgsql security definer set search_path = public as $$
declare caminho text;
begin
  if not public.e_admin() then raise exception 'Sem permissão' using errcode = '42501'; end if;
  if p_motivo is null or length(trim(p_motivo)) < 3 then raise exception 'Explique o motivo da exclusão'; end if;
  update public.documents set excluido_em = now(), excluido_por = auth.uid(), motivo_exclusao = left(trim(p_motivo), 300)
   where id = p_id and excluido_em is null
  returning arquivo_path into caminho;
  if caminho is null then raise exception 'Documento não encontrado ou já excluído'; end if;
  return caminho;
end $$;
revoke all on function public.excluir_documento(uuid, text) from public;
grant execute on function public.excluir_documento(uuid, text) to authenticated;

-- ---------------------------------------------------------------- Storage
-- Ler o arquivo: gestão sempre; visitante só se o registro for público e ativo.
create policy "monte: ler documentos" on storage.objects for select
  using (bucket_id = 'documentos' and (
    public.pode_ler_tudo()
    or exists (select 1 from public.documents d where d.arquivo_path = storage.objects.name
               and d.visibilidade = 'publico' and d.excluido_em is null)));
-- Enviar: só admin, e só nas pastas das categorias.
create policy "monte: enviar documentos" on storage.objects for insert
  with check (bucket_id = 'documentos' and public.e_admin()
    and (storage.foldername(name))[1] in ('regulamento', 'autorizacao', 'contrato', 'comprovante', 'relatorio', 'proposta', 'outro'));
-- Apagar o arquivo: só admin, e só se o registro já foi marcado como excluído (ou se o envio falhou
-- antes de criar o registro).
create policy "monte: apagar documentos excluídos" on storage.objects for delete
  using (bucket_id = 'documentos' and public.e_admin() and (
    exists (select 1 from public.documents d where d.arquivo_path = storage.objects.name and d.excluido_em is not null)
    or not exists (select 1 from public.documents d where d.arquivo_path = storage.objects.name)));
