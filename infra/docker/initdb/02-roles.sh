#!/usr/bin/env bash
#
# Stage 01 step 2 — the four database roles.
#
#   migrator      the only role that may DDL. Owns the schema. CI and deploys use it.
#   app_rw        the web application. DML only, RLS enforced.
#   worker_rw     the BullMQ workers. DML only, RLS enforced.
#   analytics_ro  SELECT on de-identified views only. Never sees a base table.
#
# Least privilege, §1.3. The separation is what makes "no service-role query without an
# explicit, logged justification" enforceable rather than aspirational: app_rw simply
# cannot do the things a compromised application would want to do.
#
# This is a shell script rather than plain SQL so passwords come from the environment.
# Rule 7: no secret in the repository, not even a dev default. An unset variable fails
# the container's bootstrap loudly instead of creating a role with a guessable password.

set -euo pipefail

for required in APP_RW_PASSWORD WORKER_RW_PASSWORD MIGRATOR_PASSWORD ANALYTICS_RO_PASSWORD; do
  if [ -z "${!required:-}" ]; then
    echo "initdb: $required is not set. Refusing to create a role without a password." >&2
    exit 1
  fi
done

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- NOSUPERUSER and NOBYPASSRLS are the point of this file. A role with BYPASSRLS
    -- would silently defeat every tenant-isolation policy in the schema, and the RLS
    -- suite would still pass, because it would be testing a role that no longer has the
    -- constraint under test.
    CREATE ROLE migrator     LOGIN PASSWORD '${MIGRATOR_PASSWORD}'     NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    CREATE ROLE app_rw       LOGIN PASSWORD '${APP_RW_PASSWORD}'       NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    CREATE ROLE worker_rw    LOGIN PASSWORD '${WORKER_RW_PASSWORD}'    NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    CREATE ROLE analytics_ro LOGIN PASSWORD '${ANALYTICS_RO_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

    -- The schema belongs to migrator. Nobody else may change its shape.
    CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION migrator;

    GRANT CONNECT ON DATABASE "${POSTGRES_DB}" TO migrator, app_rw, worker_rw, analytics_ro;
    GRANT USAGE ON SCHEMA app TO app_rw, worker_rw, analytics_ro;

    -- No CREATE for the runtime roles: DDL is migrator's alone (step 2).
    REVOKE CREATE ON SCHEMA app FROM app_rw, worker_rw, analytics_ro;
    REVOKE ALL ON SCHEMA public FROM PUBLIC;

    -- Default privileges apply to tables migrator creates from here on, so a new table
    -- in a later stage is reachable by the application without a follow-up grant — and,
    -- more importantly, is NOT reachable by analytics_ro without a deliberate one.
    ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA app
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_rw, worker_rw;
    ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA app
      GRANT USAGE, SELECT ON SEQUENCES TO app_rw, worker_rw;

    -- analytics_ro gets nothing here, deliberately. It is granted SELECT on the
    -- de-identified views built in Stage 09 (MOD-03), and on nothing else, ever. An
    -- empty grant now is the honest state: there is nothing de-identified to read yet.
EOSQL

echo "initdb: created migrator, app_rw, worker_rw, analytics_ro"
