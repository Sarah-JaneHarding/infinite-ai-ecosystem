# Database restore

**RTO:** ≤ 60 minutes from declaring an incident to serving traffic from the restored database.
**RPO:** ≤ 5 minutes of data loss (Postgres continuous WAL archiving).

**Status:** Written in Stage 15. Live drill against staging required before GA.

## What the alert means

`web_availability_burn_rate` or a DBA-raised incident reports that the primary Postgres instance is corrupted, inaccessible, or serving incorrect data that cannot be fixed with a forward migration. Typical triggers: storage corruption, a failed migration that left the schema in an inconsistent state, accidental DDL by a superuser, or a cloud provider incident.

This is **not** the runbook for a slow query or a lock contention spike — those are handled by the `queue-backlog.md` runbook.

## Who owns it

On-call platform engineer. Escalate to the database tech lead if the cause is unclear after the first action, and to the POPIA/data-protection contact if the restore would reintroduce data that a tombstone or erasure had already removed.

## The first action

Stop write traffic to the affected tenant(s) by pausing the worker process. Do not stop reads — teachers need to see existing approved artefacts. Do **not** run any `DELETE`, `TRUNCATE`, `UPDATE`, or `DROP` against a live table before capturing a `pg_dump` of the current (possibly corrupted) state.

## How to confirm the diagnosis

1. `psql -c "SELECT pg_database_size(current_database());"` — compare with the baseline in the last daily health check.
2. `psql -c "SELECT count(*) FROM audit_event WHERE tenant_id = '<tenant>';"` — a sudden drop indicates data loss.
3. Review `pg_log` for `FATAL` or `PANIC` messages in the window.
4. Check the cloud provider's storage health dashboard.

## The fix

### Point-in-time recovery (preferred)

1. Identify the last clean checkpoint time from the WAL archive or the cloud console.
2. Provision a new Postgres instance from the PITR backup to that timestamp.
3. Run `prisma migrate deploy` against the new instance to confirm the schema matches.
4. Run the RLS integration suite (`pnpm --filter @infinite-ai/db test:integration`) against the new instance.
5. Switch the `DATABASE_URL` secret to point at the new instance.
6. Resume the worker process.

### Restore from daily snapshot (fallback if WAL archive is unavailable)

1. Restore the most recent daily snapshot.
2. Accept the data loss up to the snapshot age (RPO degraded).
3. Replay any audit events from the `audit_event` table backup to reconstruct the gap.
4. Document the gap in `docs/STAGE_LOG.md` under an incident heading.

## How to verify recovery

- `pnpm --filter @infinite-ai/db test:integration` exits 0.
- `SELECT count(*) FROM audit_event` matches the pre-incident baseline (within the known WAL gap).
- A synthetic write (`pnpm --filter @infinite-ai/db db:seed`) succeeds and is visible in a read.
- Web traffic resumes without 5xx errors.

## What to record afterwards

- Incident start time, detection time, resolution time (actual RTO).
- Data loss window (actual RPO).
- Root cause.
- Whether the restore drill RTO/RPO targets were met.
- Entry in `docs/RUNBOOKS/drill-results/` with date and evidence.

## Which test would have caught this earlier

`pnpm --filter @infinite-ai/db test:integration` — the RLS and schema-classification suites both exercise live Postgres and catch migration drift and constraint violations.
