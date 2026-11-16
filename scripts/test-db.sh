#!/usr/bin/env bash
# Runs the database tests against a temporary Postgres server.
# Needs the Postgres programs (initdb, pg_ctl) on the PATH. No Docker and no Supabase project.
set -euo pipefail

command -v initdb >/dev/null || { echo "initdb not found. Install PostgreSQL (for example: brew install postgresql@17)." >&2; exit 1; }

dir="$(mktemp -d)"
port="${TEST_DB_PORT:-54329}"
cleanup() {
  pg_ctl -D "$dir/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$dir"
}
trap cleanup EXIT

initdb -D "$dir/data" -U postgres --auth=trust >/dev/null
pg_ctl -D "$dir/data" -o "-p $port -k $dir -c listen_addresses=''" -l "$dir/log" -w start >/dev/null

export TEST_DATABASE_URL="postgresql://postgres@/postgres?host=$dir&port=$port"
npx vitest run --project db "$@"
