# Region loss

**RTO:** ≤ 4 hours from declaring a region-loss incident to serving traffic from the secondary region.
**RPO:** ≤ 60 minutes of data loss (continuous WAL shipping to the secondary region, Brain snapshots every hour).

**Status:** Written in Stage 15. Annual drill required (see `docs/RUNBOOKS/README.md`).

## What the alert means

The primary cloud region (af-south-1 / Cape Town) is inaccessible or has declared an availability incident that affects the primary Postgres instance, the object-storage bucket, and/or the worker subnet. The `web_availability_burn_rate` alert fires and the gateway's health endpoint returns `503` for more than 5 consecutive minutes.

## Who owns it

On-call platform engineer (technical lead), with the CEO and affected school accounts notified within 30 minutes. Data residency: South African schools' data must remain in South Africa unless the school has explicitly consented to cross-border transfer (POPIA §72). The secondary region must satisfy this constraint — confirm before initiating failover.

## The first action

Confirm the outage is a region-level event, not a single-service incident:

1. Check the cloud provider's status page.
2. Try to reach the health endpoint from outside the region: `curl https://api.infinite-ai.benjaminpine.co.za/health`.
3. If both confirm a region loss, declare the incident and begin failover.

## How to confirm the diagnosis

- Cloud provider's status page shows `af-south-1` degraded or down.
- `web_availability_burn_rate` is at full burn (near 100% error rate).
- Database primary is not responding to connection attempts from the secondary region's worker.

## The fix

### Failover sequence

1. **Promote the read replica** in the secondary region to a writable primary:
   - Cloud console → RDS / Cloud SQL → Promote replica.
   - Confirm replication lag before promotion: `SELECT now() - pg_last_xact_replay_timestamp();` on the replica.

2. **Update DNS / load balancer** to point `api.infinite-ai.benjaminpine.co.za` at the secondary region's worker.

3. **Start the worker** in the secondary region if it is not already running.

4. **Confirm the Brain** snapshot in object storage is accessible from the secondary region. The most recent snapshot is at `gs://<bucket>/brain-snapshots/<date>/`. If the snapshot is more than 1 hour old, accept the RPO degradation and document it.

5. **Update `DATABASE_URL`** in the secondary region's environment to point at the promoted replica.

6. **Resume writes** — restart the worker to begin processing queued jobs.

### Communication

- Notify all active tenants by email within 30 minutes of declaring the incident.
- Post a status update every 30 minutes until service is restored.
- Notify the Information Regulator if the region loss resulted in a data breach (cross with `suspected-breach.md`).

### Failback (when the primary region recovers)

1. Let the promoted replica catch up as a replica of the new primary (which is now the secondary region's database).
2. When lag is zero, promote the original primary back.
3. Update DNS to point back at the primary region.
4. Drain and shut down the secondary region worker.

## How to verify recovery

- `web_availability_burn_rate` returns to 0.
- `pnpm --filter @infinite-ai/db test` exits 0 against the promoted replica.
- `SELECT count(*) FROM audit_event WHERE tenant_id = '<tenant>'` matches the expected count ± the RPO window.
- A synthetic end-to-end run (`pnpm evals:run --all`) succeeds.

## What to record afterwards

- Region-loss declaration time, failover completion time (actual RTO).
- Replication lag at promotion time (actual RPO).
- Data residency confirmed for the secondary region used.
- Tenants affected and notification times.
- Whether failback was required and when it completed.
- Entry in `docs/RUNBOOKS/drill-results/` with date and evidence.

## Which test would have caught this earlier

This scenario is infrastructure-level and cannot be caught by a unit or integration test. The annual drill is the verification mechanism. The `pnpm --filter @infinite-ai/db test:integration` suite running against the promoted replica is the post-failover verification.
