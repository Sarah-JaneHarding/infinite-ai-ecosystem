# Queue backlog

**RTO:** ≤ 30 minutes from detecting the backlog to queue depth returning to baseline.
**RPO:** 0 — jobs are durable in Postgres; no job is lost when a worker crashes.

**Status:** Written in Stage 15.

## What the alert means

`orchestrator.queue.depth` or `orchestrator.queue.age_ms` exceeds its SLO threshold, meaning artefacts are not reaching the approval queue within the time-to-artefact P95 SLO (30 seconds). Typical triggers: worker process crashed, a surge of run requests (e.g. term-start), a slow provider causing jobs to pile up, or a single tenant flooding the queue.

## Who owns it

On-call platform engineer. Escalate to the product team if the backlog is caused by a tenant flooding and per-tenant rate limiting needs adjustment.

## The first action

Check whether any worker process is running:

```bash
systemctl status infinite-ai-worker   # or equivalent for the deployment platform
```

If no worker is running, start it. That is the most common cause and resolves in under 2 minutes.

## How to confirm the diagnosis

1. `orchestrator.queue.depth` metric — is it growing, stable, or draining?
2. `orchestrator.queue.age_ms` metric — what is the oldest job's age?
3. Worker error logs — is there a repeated exception causing restarts?
4. Provider error logs — is the gateway returning errors that cause retries to pile up?
5. Per-tenant breakdown — is one tenant responsible for >50% of the queue?

## The fix

### Worker is down

Start the worker. The queue drains automatically.

### Worker is running but slow (provider throttling)

1. Check `gateway.provider_fallback_total` — if the primary is throttling, see `provider-outage.md`.
2. If the provider is healthy but slow, scale the worker horizontally (add more replicas).

### Noisy neighbour (one tenant flooding)

1. Identify the tenant from `orchestrator.queue.depth` broken down by `tenant.id`.
2. Apply a temporary per-tenant rate limit at the gateway: set `TENANT_<ID>_RATE_LIMIT_PER_MINUTE` in the environment.
3. Notify the tenant's account owner.

### Dead-letter queue (job repeatedly failing)

1. Identify the stuck job ID from the orchestrator logs.
2. Inspect the job payload for a malformed input (e.g. a missing required field after a schema change).
3. If the input is unrecoverable, mark the job as failed in the database with a reason and notify the tenant.

## How to verify recovery

- `orchestrator.queue.depth` returns to < 10.
- `orchestrator.queue.age_ms` P99 < 30 seconds.
- `agent.run.success.total` recovers to baseline rate.

## What to record afterwards

- Cause, start time, resolution time (actual RTO).
- Peak queue depth and age reached.
- Number of artefacts delayed beyond the SLO.
- Entry in `docs/RUNBOOKS/drill-results/`.

## Which test would have caught this earlier

`pnpm --filter @infinite-ai/orchestrator test:integration` — the concurrency and durability suite asserts the queue drains under load and jobs survive a worker restart.
