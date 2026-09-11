#!/usr/bin/env bash
# Run once per environment, after `terraform apply` first creates that environment's RDS
# instance — never checked into any CI pipeline unattended, since it needs a human with
# real AWS credentials and network access to the database (a bastion, VPN, or an
# ECS-exec'd shell in the same VPC; nothing in this repo stands one up yet).
#
# What it does, in order — the same four roles and the same grant shape
# infra/docker/initdb/02-roles.sh already defines for dev, replayed against a real
# instance instead of the dev container, so the app's own migrations and RLS policies
# apply completely unchanged:
#   1. Reads the RDS master password Terraform never touches (manage_master_user_password)
#      and each generated app-role password (both from Secrets Manager) straight into
#      shell variables — never to a file, never echoed.
#   2. Connects as the master user and creates infra/docker/initdb/01-extensions.sql's
#      same three extensions (vector, pg_trgm, pgcrypto) — RDS Postgres 15+ allows this
#      for its master user without a custom parameter group.
#   3. Creates each of infra/docker/initdb/02-roles.sh's same four role names with the
#      password Terraform generated for it, and the exact same schema-ownership and
#      privilege grants that script already documents the reasoning for (verbatim, not
#      re-derived here) — migrator owns `public`; app_rw/worker_rw get DML on tables
#      migrator creates from here on, never CREATE; analytics_ro gets nothing yet.
#
# Idempotent: every statement uses IF NOT EXISTS / OR REPLACE, so re-running after a
# credential rotation (which does not change the role, only the password Secrets Manager
# holds) is safe — it re-sets the password to whatever Secrets Manager currently says and
# no-ops every grant that already exists.
#
# Requires: aws CLI (configured for the target account/region), psql, jq.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <environment-name>   (e.g. infinite-ai-staging — must match this" >&2
  echo "  environment's Terraform var.name, and be the same name used for the" >&2
  echo "  Secrets Manager path prefix '<name>/db/<role>')." >&2
  exit 1
fi

ENV_NAME="$1"
DB_IDENTIFIER="$ENV_NAME"
DB_NAME="${ENV_NAME//-/_}"

echo "Looking up RDS instance and master credentials for ${ENV_NAME}..." >&2

DB_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier "$DB_IDENTIFIER" \
  --query 'DBInstances[0].Endpoint.Address' --output text)

MASTER_SECRET_ARN=$(aws rds describe-db-instances \
  --db-instance-identifier "$DB_IDENTIFIER" \
  --query 'DBInstances[0].MasterUserSecret.SecretArn' --output text)

MASTER_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id "$MASTER_SECRET_ARN" \
  --query 'SecretString' --output text | jq -r '.password')

export PGPASSWORD="$MASTER_PASSWORD"

echo "Creating extensions (idempotent)..." >&2
psql -h "$DB_ENDPOINT" -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
SQL

for ROLE in migrator app_rw worker_rw analytics_ro; do
  echo "Creating/updating role '${ROLE}'..." >&2
  ROLE_PASSWORD=$(aws secretsmanager get-secret-value \
    --secret-id "${ENV_NAME}/db/${ROLE}" \
    --query 'SecretString' --output text | jq -r '.password')

  psql -h "$DB_ENDPOINT" -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -v role="$ROLE" -v pw="$ROLE_PASSWORD" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'role') THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS', :'role', :'pw');
  ELSE
    EXECUTE format('ALTER ROLE %I PASSWORD %L', :'role', :'pw');
  END IF;
END
$$;
SQL
done

echo "Applying schema ownership and grants (same shape as infra/docker/initdb/02-roles.sh)..." >&2
psql -h "$DB_ENDPOINT" -U postgres -d postgres -v ON_ERROR_STOP=1 -v dbname="$DB_NAME" <<'SQL'
ALTER SCHEMA public OWNER TO migrator;

GRANT CONNECT ON DATABASE :"dbname" TO migrator, app_rw, worker_rw, analytics_ro;
GRANT USAGE ON SCHEMA public TO app_rw, worker_rw, analytics_ro;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM app_rw, worker_rw, analytics_ro;

ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_rw, worker_rw;
ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_rw, worker_rw;
SQL

unset PGPASSWORD

echo "Done. '${DB_ENDPOINT}' is ready for 'pnpm --filter @infinite-ai/db db:migrate:deploy'" >&2
echo "(as migrator) and app traffic (as app_rw / worker_rw)." >&2
