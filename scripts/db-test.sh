#!/usr/bin/env bash
# Testa as migrações e as permissões (RLS) num Postgres local descartável, imitando o Supabase.
# Não toca no projeto real. Uso (exemplo):
#   PGHOST=/caminho/do/socket PGPORT=5432 PGUSER=postgres scripts/db-test.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=monte_teste_$$
psql -q -v ON_ERROR_STOP=1 -d postgres -c "create database $DB" >/dev/null
trap 'psql -q -d postgres -c "drop database if exists $DB" >/dev/null' EXIT
run() { psql -q -X -v ON_ERROR_STOP=1 -d "$DB" -f "$1" >/dev/null && echo "ok   aplicada $(basename "$1")"; }
run supabase/tests/00_supabase_local.sql
for f in supabase/migrations/*.sql; do run "$f"; done
OUT=$(mktemp)
status=0
for f in supabase/tests/[1-9]*.sql; do
  psql -X -v ON_ERROR_STOP=1 -d "$DB" -f "$f" >"$OUT" 2>&1 || status=$?
  grep -E 'NOTICE|ERROR' "$OUT" | sed -E 's/^psql:[^ ]+ (NOTICE|ERROR):  /\1 /; s/^NOTICE //'
  [ $status -ne 0 ] && { echo "FALHOU em $f"; exit $status; }
done
echo "$(grep -hc '^select t\.\(ok\|falha\)' supabase/tests/[1-9]*.sql | paste -sd+ | bc) verificações de banco passaram."
