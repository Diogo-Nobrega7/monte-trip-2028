#!/usr/bin/env bash
# Sobe um "Supabase local" para teste de ponta a ponta, SEM tocar no projeto real:
#   Postgres local (PGHOST/PGPORT/PGUSER) + Storage e PostgREST oficiais em Docker + gateway com login de teste.
# Depois: build do site apontando para http://localhost:54321, vite preview e node scripts/e2e/e2e.cjs.
# Uso: PGHOST=... PGPORT=... PGUSER=postgres scripts/e2e/subir.sh   (repetir zera o banco de teste)
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"; R="$D/../.."
STORE="${STORE:-/tmp/monte-e2e-storage}"; mkdir -p "$STORE"; chmod 777 "$STORE"; rm -rf "$STORE"/*
SECRET=segredo-de-teste-local-com-mais-de-32-caracteres
eval "$(node "$D/jwt.mjs" print | sed 's/^/export /')"
docker rm -f e2e-storage e2e-rest >/dev/null 2>&1 || true
psql -q -d postgres -c "drop database if exists monte_e2e" -c "create database monte_e2e"
psql -q -d monte_e2e -v ON_ERROR_STOP=1 -f "$D/bootstrap.sql" 2>/dev/null
# o Postgres precisa aceitar conexão TCP em 127.0.0.1:$PGPORT para os containers
docker run -d --name e2e-storage --network host -v "$STORE":/mnt \
  -e ANON_KEY="$ANON" -e SERVICE_KEY="$SERVICE" -e AUTH_JWT_SECRET=$SECRET -e AUTH_JWT_ALGORITHM=HS256 -e PGRST_JWT_SECRET=$SECRET \
  -e DATABASE_URL="postgres://supabase_storage_admin:x@127.0.0.1:${PGPORT:-5432}/monte_e2e" -e DB_INSTALL_ROLES=false \
  -e FILE_SIZE_LIMIT=52428800 -e STORAGE_BACKEND=file -e FILE_STORAGE_BACKEND_PATH=/mnt -e TENANT_ID=stub -e REGION=stub \
  -e STORAGE_S3_REGION=stub -e GLOBAL_S3_BUCKET=stub -e ENABLE_IMAGE_TRANSFORMATION=false -e SERVER_PORT=5000 -e PORT=5000 \
  supabase/storage-api:v1.84.19 >/dev/null
sleep 10   # o Storage cria o esquema storage
psql -q -d monte_e2e -c "grant usage on schema storage to anon, authenticated, service_role; grant all on all tables in schema storage to anon, authenticated, service_role; grant all on all functions in schema storage to anon, authenticated, service_role;"
for f in "$R"/supabase/migrations/*.sql; do psql -q -X -v ON_ERROR_STOP=1 -d monte_e2e -f "$f" >/dev/null; echo "ok   $(basename "$f")"; done
psql -q -d monte_e2e -c "insert into auth.users (id, email) values ('a0000000-0000-0000-0000-000000000001','davi@teste.local'),('b0000000-0000-0000-0000-000000000002','prof@teste.local'); insert into public.profiles (id, nome, papel) values ('a0000000-0000-0000-0000-000000000001','Davi','admin'),('b0000000-0000-0000-0000-000000000002','Prof. Ana','supervisor');"
docker run -d --name e2e-rest --network host -e PGRST_DB_URI="postgres://authenticator:x@127.0.0.1:${PGPORT:-5432}/monte_e2e" \
  -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET=$SECRET -e PGRST_SERVER_PORT=3000 postgrest/postgrest:v12.2.3 >/dev/null
pgrep -f "e2e/gateway.mjs" >/dev/null || (node "$D/gateway.mjs" >/tmp/monte-e2e-gateway.log 2>&1 &)
sleep 2
echo "Pronto. Chave anônima de teste: $ANON"
echo "Build: VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_PUBLISHABLE_KEY=<chave acima> npx vite build --outDir /tmp/monte-e2e-dist"
