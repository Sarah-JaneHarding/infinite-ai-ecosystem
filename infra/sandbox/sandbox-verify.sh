#!/usr/bin/env bash
# Smoke-tests the running sandbox against the platform's own invariants. Run inside the toolbox:
#   pnpm sandbox verify
#
# This is not the test suite: it proves the sandbox itself is wired the way production is — the four
# database roles exist, every migration ran, row-level security FAILS CLOSED for the application role
# (CLAUDE.md invariant 1: a query with no tenant context errors rather than matching nothing), a tenant
# context sees only its own tenant, the identity provider serves the realm, Redis answers, and the
# dev identities are seeded. Exit 0 only if every check passes.
#
#   SANDBOX_REPO_DIR          where the migrations are read from (default /workspace, the toolbox copy)
#   SANDBOX_VERIFY_DB_ONLY=1  check only the database (no Keycloak or Redis) — for a database that was
#                             set up some other way
set -uo pipefail

REPO_DIR="${SANDBOX_REPO_DIR:-/workspace}"

DEV_TENANT='10000000-0000-4000-8000-000000000001'
failures=0
pass() { printf '  \033[32mPASS\033[0m  %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; failures=$((failures + 1)); }
need() { : "${!1:?sandbox-verify: $1 is not set (run it through \`pnpm sandbox verify\`)}"; }
need MIGRATOR_DATABASE_URL; need APP_RW_DATABASE_URL
[ "${SANDBOX_VERIFY_DB_ONLY:-0}" = 1 ] || need KEYCLOAK_INTERNAL_URL

q() { psql "$1" -X -q -tA -v ON_ERROR_STOP=1 -c "$2" 2>&1; }

echo "Database"
roles=$(q "$MIGRATOR_DATABASE_URL" "SELECT string_agg(rolname, ',' ORDER BY rolname) FROM pg_roles WHERE rolname IN ('migrator','app_rw','worker_rw','analytics_ro')")
[ "$roles" = "analytics_ro,app_rw,migrator,worker_rw" ] && pass "the four roles exist ($roles)" || fail "roles: got '$roles'"

ext=$(q "$MIGRATOR_DATABASE_URL" "SELECT string_agg(extname, ',' ORDER BY extname) FROM pg_extension WHERE extname IN ('vector','pg_trgm','pgcrypto')")
[ "$ext" = "pgcrypto,pg_trgm,vector" ] || [ "$ext" = "pg_trgm,pgcrypto,vector" ] && pass "extensions present ($ext)" || fail "extensions: got '$ext'"

expected=$(find "$REPO_DIR/packages/db/prisma/migrations" -mindepth 2 -maxdepth 2 -name migration.sql | wc -l)
applied=$(q "$MIGRATOR_DATABASE_URL" "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL")
[ "$applied" = "$expected" ] && pass "all $expected migrations applied" || fail "migrations: $applied applied, $expected on disk"

if out=$(q "$APP_RW_DATABASE_URL" "SELECT count(*) FROM tenant"); then
  fail "RLS fails OPEN: app_rw read tenant with no tenant context (got '$out')"
else
  case "$out" in
    *app.tenant_id*) pass "RLS fails closed: no tenant context is an error, not an empty result" ;;
    *) fail "app_rw query failed, but not for the tenant-context reason: $out" ;;
  esac
fi

own=$(psql "$APP_RW_DATABASE_URL" -X -q -tA -v ON_ERROR_STOP=1 <<SQL 2>&1
BEGIN;
SELECT set_config('app.tenant_id', '$DEV_TENANT', true);
SELECT count(*) FROM tenant;
COMMIT;
SQL
)
own=$(printf '%s\n' "$own" | tail -n 1)
[ "$own" = "1" ] && pass "a tenant context sees exactly its own tenant" || fail "tenant context saw '$own' tenants, expected 1"

accounts=$(psql "$MIGRATOR_DATABASE_URL" -X -q -tA -v ON_ERROR_STOP=1 <<SQL 2>&1
BEGIN;
SELECT set_config('app.tenant_id', '$DEV_TENANT', true);
SELECT count(*) FROM user_account;
COMMIT;
SQL
)
accounts=$(printf '%s\n' "$accounts" | tail -n 1)
if [ "$accounts" -ge 7 ] 2>/dev/null; then pass "dev identities seeded ($accounts accounts at the dev school)"; else fail "dev identities: '$accounts' accounts, expected at least 7"; fi

if [ "${SANDBOX_VERIFY_DB_ONLY:-0}" != 1 ]; then
echo "Services"
if curl -fsS --max-time 10 "$KEYCLOAK_INTERNAL_URL/realms/infinite-ai/.well-known/openid-configuration" >/dev/null 2>&1; then
  pass "Keycloak serves the infinite-ai realm"
else
  fail "Keycloak realm discovery failed at $KEYCLOAK_INTERNAL_URL"
fi

if reply=$(exec 3<>/dev/tcp/redis/6379 && printf 'PING\r\n' >&3 && head -n1 <&3 | tr -d '\r'); [ "$reply" = "+PONG" ]; then
  pass "Redis answers PING"
else
  fail "Redis did not answer PING (got '$reply')"
fi
fi

echo
if [ "$failures" -eq 0 ]; then echo "Sandbox verified."; else echo "$failures check(s) failed."; fi
exit "$failures"
