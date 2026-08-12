# Canary Deploy Runbook

RTO: 30 minutes (rollback to previous version)
RPO: 0 (no data written by the canary that cannot be rolled back at the application layer)

---

## Overview

Canary deploys route a small fraction of production traffic to the new version while the
old version continues to serve the rest. If the canary violates SLOs, an automatic
rollback fires. This runbook covers manual execution and the automatic rollback trigger.

---

## When to use a canary deploy

- Any change to `apps/gateway` or `apps/web`.
- Any database migration that adds a column, index, or table (additive changes only —
  destructive migrations require a separate, explicitly approved step per CLAUDE.md rule 10).
- Any change to `packages/guardrails`, `packages/policy`, or `packages/deident`.

Do NOT use canary for:

- Configuration-only changes (env vars, flag flips).
- Documentation-only changes.
- Hotfixes to an active P1 incident (go straight to full deploy).

---

## Pre-deploy checklist

- [ ] `pnpm verify:stage 18` exits 0 on the commit being deployed.
- [ ] Database migrations applied: `pnpm --filter @infinite-ai/db db:migrate:deploy`.
- [ ] Migrations are backwards-compatible with the current running version (old code can
      read new schema; new code can read old schema until 100 % rollout).
- [ ] Feature flags: any new behaviour gated behind a flag that is off by default.
- [ ] `pnpm check:flags` exits 0 (no expired flags).
- [ ] Runbook reviewed by the deploying engineer and the on-call engineer.

---

## Canary rollout steps

### Step 1 — Deploy canary (5 % traffic)

```bash
# Set canary weight to 5 % in your load balancer / deployment platform.
# Example for a Kubernetes ingress with weighted routing:
kubectl set image deployment/gateway gateway=<new-image>:<sha>
kubectl apply -f infra/k8s/canary-5pct.yaml
```

Monitor for **15 minutes**:

- Error rate: `gateway.error_rate` < 0.5 %
- p95 latency: `gateway.latency_p95` < 8 s
- No RLS policy violations logged

### Step 2 — Advance to 25 %

If step 1 monitors are green after 15 minutes:

```bash
kubectl apply -f infra/k8s/canary-25pct.yaml
```

Monitor for **15 minutes** with the same thresholds.

### Step 3 — Advance to 50 %

```bash
kubectl apply -f infra/k8s/canary-50pct.yaml
```

Monitor for **15 minutes**.

### Step 4 — Full rollout (100 %)

```bash
kubectl apply -f infra/k8s/canary-100pct.yaml
kubectl delete -f infra/k8s/canary-5pct.yaml  # clean up routing rules
```

Confirm all metrics are stable for 30 minutes before closing the deploy.

---

## Automatic rollback trigger

The monitoring system fires a rollback if, during any canary step:

- **Error rate** > 1 % for 2 consecutive minutes, OR
- **p95 latency** > 10 s for 2 consecutive minutes.

When the trigger fires:

1. Traffic routing reverts to 0 % canary immediately (< 30 seconds).
2. The on-call engineer is paged.
3. The canary deployment is halted.
4. An incident is opened automatically.

---

## Manual rollback

If automatic rollback does not fire but you need to roll back:

```bash
# Revert routing to previous version immediately.
kubectl apply -f infra/k8s/canary-0pct.yaml

# Confirm traffic is fully on the old version.
kubectl rollout status deployment/gateway

# Revert the commit and push.
git revert <canary-sha>
git push origin main

# Apply the revert deploy (no canary needed for a rollback).
kubectl set image deployment/gateway gateway=<previous-image>:<sha>
```

If the migration is not backwards-compatible (unusual; should not happen if the
pre-deploy checklist was followed), the rollback must include a down migration. This
requires explicit approval — see CLAUDE.md rule 10.

---

## Post-canary verification

After a successful full rollout:

```bash
pnpm verify:stage 18
pnpm test:security
pnpm test:telemetry-coverage
```

Update `docs/STAGE_LOG.md` if this deploy completes a stage gate.

---

## Contacts

- Primary on-call: see PagerDuty rotation.
- Secondary on-call: see PagerDuty rotation.
- Security lead: see `INCIDENT_PROCESS.md`.
- Escalation for data-layer issues: database owner.
