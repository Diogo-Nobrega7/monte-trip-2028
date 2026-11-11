#!/usr/bin/env node
// Converte a cópia de segurança (JSON baixado em Configurações) num arquivo SQL de restauração.
// Não conecta em nada: só lê o JSON e escreve SQL. Passo a passo em docs/BACKUP.md.
//
// Uso:
//   node scripts/restaurar-backup.mjs backup.json > restaurar.sql
//   node scripts/restaurar-backup.mjs backup.json --usuario <id-antigo>=<id-novo> ... > restaurar.sql
//
// --usuario troca o id de uma conta antiga pelo id da conta recriada no projeto novo
// (Authentication → Users). Contas sem troca ficam com o id antigo e precisam existir com o mesmo id.
import { readFileSync } from 'node:fs'

const [file, ...args] = process.argv.slice(2)
if (!file) { console.error('Uso: node scripts/restaurar-backup.mjs backup.json [--usuario antigo=novo ...] > restaurar.sql'); process.exit(1) }
const b = JSON.parse(readFileSync(file, 'utf8'))
if (b.formato !== 'monte-trip-2028/backup' || b.versao !== 1) { console.error('Arquivo não é uma cópia de segurança do Monte Trip 2028 (versão 1).'); process.exit(1) }

const map = new Map()
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--usuario') { const [a, n] = (args[++i] ?? '').split('='); if (!a || !n) { console.error('Use --usuario antigo=novo'); process.exit(1) } map.set(a, n) }
}
const USER_COLS = new Set(['conferido_por', 'criado_por', 'registrado_por', 'alterado_por', 'aprovado_por', 'proposto_por', 'decidido_por', 'enviado_por', 'excluido_por', 'usuario'])

const lit = (v) => {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'number' || typeof v === 'bigint') return String(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
  return `'${String(v).replace(/'/g, "''")}'`
}
const out = []
function insert(table, rows, { identity = false, transform = (r) => r } = {}) {
  if (!rows?.length) return
  out.push(`-- ${table}: ${rows.length}`)
  for (const raw of rows) {
    const r = transform({ ...raw })
    for (const k of Object.keys(r)) if (USER_COLS.has(k) && map.has(r[k])) r[k] = map.get(r[k])
    const cols = Object.keys(r)
    out.push(`insert into public.${table} (${cols.map((c) => `"${c}"`).join(', ')})${identity ? ' overriding system value' : ''} values (${cols.map((c) => lit(r[c])).join(', ')});`)
  }
}
const originalsFirst = (rows = []) => [...rows].sort((a, b) => (a.estorno_de ? 1 : 0) - (b.estorno_de ? 1 : 0))
const t = b.tabelas

out.push(`-- Restauração Monte Trip 2028 — cópia de ${b.gerado_em}`)
out.push('-- Rodar no SQL Editor de um projeto NOVO, depois das migrações (supabase/migrations) e de recriar as contas.')
out.push('begin;')
out.push('-- desliga gatilhos durante a carga (auditoria e validações já valeram quando os dados foram gravados)')
out.push('set local session_replication_role = replica;')
out.push('-- o projeto novo já nasce com a configuração inicial; a do backup substitui')
out.push('delete from public.config_versions;')
insert('profiles', (t.profiles ?? []).map((p) => ({ ...p, id: map.get(p.id) ?? p.id })))
insert('config_versions', t.config_versions, { identity: true, transform: (r) => ({ ...r, proposta_id: null }) })
insert('config_proposals', t.config_proposals, { identity: true })
for (const v of t.config_versions ?? []) if (v.proposta_id) out.push(`update public.config_versions set proposta_id = ${v.proposta_id} where id = ${v.id};`)
insert('students', t.students)
insert('installments', t.installments)
insert('payments', originalsFirst(t.payments))
insert('fundraisings', t.fundraisings)
insert('fundraising_entries', originalsFirst(t.fundraising_entries))
insert('expenses', originalsFirst(t.expenses))
insert('yields', originalsFirst(t.yields))
insert('agencies', t.agencies)
insert('proposals', t.proposals)
insert('documents', t.documents)
insert('conferencias', t.conferencias, { identity: true })
insert('saldos_bancarios', t.saldos_bancarios)
insert('audit_log', t.audit_log, { identity: true })
for (const [table, col] of [['config_versions', 'id'], ['config_proposals', 'id'], ['conferencias', 'id'], ['audit_log', 'id']]) {
  out.push(`select setval(pg_get_serial_sequence('public.${table}', '${col}'), coalesce((select max(${col}) from public.${table}), 1));`)
}
out.push('commit;')
out.push('-- Conferência: estes totais devem bater com o Painel antes da perda.')
out.push('select * from public.resumo_publico();')
process.stdout.write(out.join('\n') + '\n')
