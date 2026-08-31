# Canary Deploy Runbook

RTO: 30 minutes (rollback to previous version)
RPO: 0 (no data written by the canary that cannot be rolled back at the application layer)

**Update:** this runbook previously described a `kubectl`-based procedure against
`infra/k8s/` manifests that were never actually built — orchestrator choice (ECS vs.
Kubernetes) had never been decided when it was written. It's ECS Fargate
(`infra/terraform/modules/ecs-service`); see that module's own README for why. Rewritten
below to match what that Terraform actually provisions, and to be honest about what it
does not: **a true weighted canary (5% → 25% → 50% → 100% traffic split) needs a second,
paired target group per service and either a weighted listener rule or an AWS CodeDeploy
blue/green deployment — neither exists yet.** What's below is ECS's own rolling
deployment, monitored against the same thresholds this runbook always used, with a real
rollback path — not a weighted canary. The gap is scoped at the end.

---

## Overview

A deploy pushes a new image, updates the ECS service to a new task definition revision,
and ECS rolls the new revision out (default: 200% max, 100% min healthy — replace tasks
one at a time, never below the desired count). This runbook covers running that rollout
deliberately — one task at a time, watched — rather than all at once, and the rollback
path if it goes wrong.

**Update:** `.github/workflows/cd.yml` now runs this same rollout automatically on every
merge to `main` — build, push, register a new task definition revision, update the
service, wait for it to stabilise, then poll the alarms below for a few minutes and roll
back automatically if one fires (see "Automatic rollback" below for exactly what that
does and does not cover). Staging deploys automatically; production sits behind a
GitHub Environment's required-reviewers gate (a human approves the promotion, nothing in
the workflow can skip it). This runbook's manual commands are still the right tool for:
a deploy the "When to use this runbook" section flags for extra care, watching signals
the pipeline cannot evaluate (application logs, RLS violations), or a manual rollback
outside the pipeline's own bounded monitoring window.

---

## When to use this runbook

- Any change to `apps/gateway` or `apps/web`.
- Any database migration that adds a column, index, or table (additive changes only —
  destructive migrations require a separate, explicitly approved step per CLAUDE.md rule 10).
- Any change to `packages/guardrails`, `packages/policy`, or `packages/deident`.

Do NOT use this runbook for:

- Configuration-only changes (env vars, flag flips).
- Documentation-only changes.
- Hotfixes to an active P1 incident (go straight to full deploy — see "Full rollout" below).

---

## Pre-deploy checklist

- [ ] `pnpm verify:stage 18` exits 0 on the commit being deployed.
- [ ] Database migrations applied: `pnpm --filter @infinite-ai/db db:migrate:deploy`.
- [ ] Migrations are backwards-compatible with the current running version (old code can
      read new schema; new code can read old schema until 100% rollout).
- [ ] Feature flags: any new behaviour gated behind a flag that is off by default.
- [ ] `pnpm check:flags` exits 0 (no expired flags).
- [ ] Runbook reviewed by the deploying engineer and the on-call engineer.
- [ ] A new image is built and pushed to the service's own ECR repository (the
      `<environment>_ecr_repository_url` outputs in `infra/terraform/environments/<env>/`),
      tagged with the commit SHA — never `latest`; the ECR repository is
      `IMMUTABLE`-tagged specifically so a tag can't be silently re-pointed.

---

## Rollout steps

### Step 1 — Deploy to one task, watch the rest stay on the old version

Register a new task definition revision with the new image tag, then update the service
with a deployment configuration that only replaces the minimum:

```bash
NEW_TASK_DEF_ARN=$(aws ecs register-task-definition \
  --cli-input-json file://<(aws ecs describe-task-definition \
    --task-definition infinite-ai-<env>-gateway \
    --query 'taskDefinition' | \
    jq '.containerDefinitions[0].image = "<ecr-repo-url>:<new-sha>"' | \
    jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)') \
  --query 'taskDefinition.taskDefinitionArn' --output text)

aws ecs update-service \
  --cluster infinite-ai-<env> \
  --service infinite-ai-<env>-gateway \
  --task-definition "$NEW_TASK_DEF_ARN" \
  --deployment-configuration "minimumHealthyPercent=100,maximumPercent=$((100 + 100 / $(aws ecs describe-services --cluster infinite-ai-<env> --services infinite-ai-<env>-gateway --query 'services[0].desiredCount' --output text)))"
```

The `maximumPercent` expression above caps the rollout at exactly one extra task
regardless of `desiredCount` — with `desiredCount=2`, that's 150% (3 tasks total, 1 new);
with `desiredCount=1`, that's 200% (2 tasks total, 1 new). Confirm the deployment reached
exactly that shape:

```bash
aws ecs describe-services --cluster infinite-ai-<env> --services infinite-ai-<env>-gateway \
  --query 'services[0].deployments'
```

Monitor for **15 minutes** (the CloudWatch alarms `infra/terraform/modules/observability`
already creates, at the same thresholds this runbook has always used):

- `<env>-gateway-error-rate` — 5xx rate < 1% (target-group-wide, not new-task-only; see
  "What this cannot do" below for why).
- `<env>-gateway-latency-p95` — p95 response time < 10s.
- No RLS policy violations in the application logs (`aws logs tail
/ecs/infinite-ai-<env>-gateway --follow`).

### Step 2 — Full rollout

If step 1's monitors are green after 15 minutes, let ECS finish the rollout at its normal
deployment configuration:

```bash
aws ecs update-service \
  --cluster infinite-ai-<env> \
  --service infinite-ai-<env>-gateway \
  --task-definition "$NEW_TASK_DEF_ARN" \
  --deployment-configuration "minimumHealthyPercent=100,maximumPercent=200"

aws ecs wait services-stable --cluster infinite-ai-<env> --services infinite-ai-<env>-gateway
```

Confirm all metrics are stable for 30 minutes before closing the deploy.

---

## Automatic rollback

The CloudWatch alarms above have no `alarm_actions` wired to anything in AWS that stops
a rollout automatically — `infra/terraform/modules/observability`'s `alerts` SNS topic
notifies (an email subscription, or whatever OQ-014's real paging integration ends up
being once it exists), it does not act on its own. What does act is
`.github/workflows/cd.yml`'s own deploy step
(`scripts/cd/deploy-ecs-service.sh`): after a deploy it made stabilises, it polls the
same alarms by name for a few minutes (`aws cloudwatch describe-alarms --state-value
ALARM`) and, if any has fired, rolls the service back to the task definition revision it
captured before that deploy — no human action required.

**What this covers, and what it does not:** this is a real automatic rollback for a
deploy the CD pipeline itself made, bounded to the few minutes right after that deploy.
It is not a standing subscriber to `alerts` — an alarm that fires later, from a cause
unrelated to a deploy in progress, does not trigger anything here; that is still a page
(once OQ-014's integration exists) or the manual procedure below. A deploy run manually
via this runbook's own commands, outside the pipeline, is also not covered — a fired
alarm during a manual step 1 is still a **manual** rollback trigger, exactly as before.

---

## Manual rollback

```bash
# List recent revisions and pick the one that was running before this deploy —
# confirm by eye, never script a blind "current minus one" decrement.
aws ecs list-task-definitions --family-prefix infinite-ai-<env>-gateway --sort DESC

PREVIOUS_TASK_DEF_ARN="<the ARN you confirmed above>"

aws ecs update-service \
  --cluster infinite-ai-<env> \
  --service infinite-ai-<env>-gateway \
  --task-definition "$PREVIOUS_TASK_DEF_ARN" \
  --deployment-configuration "minimumHealthyPercent=100,maximumPercent=200"

aws ecs wait services-stable --cluster infinite-ai-<env> --services infinite-ai-<env>-gateway

# Revert the commit so the next deploy doesn't reintroduce the same regression.
git revert <bad-sha>
git push origin main
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

## What this cannot do yet (the actual gap, not glossed over)

- **No traffic-level isolation between the canary task and the rest.** Step 1 puts one
  new task behind the _same_ ALB target group as every old task — the ALB round-robins
  across all of them, so "5% of traffic" is never true; it's closer to "1 in N requests,
  N = current task count," and the CloudWatch alarms above are target-group-wide, not
  scoped to the new task alone. A bad new task's errors are diluted by the old tasks'
  successes in the same aggregate metric, which is a real detection gap against a subtle
  regression.
- **A real weighted canary needs:** a second target group per service (paired
  "stable"/"canary"), a listener rule with a `forward` action listing both target groups
  with explicit weights (or an AWS CodeDeploy `CODE_DEPLOY` deployment controller on the
  ECS service, which automates exactly this — `CodeDeployDefault.ECSCanary10Percent5Minutes`
  is the AWS-managed equivalent of this runbook's old 5%/25%/50%/100% steps). Neither is
  built in `infra/terraform/modules/ecs-service` yet — a real, scoped follow-up, not
  assumed done here.
- **Automatic rollback exists, but only around the CD pipeline's own deploys, and only
  for a few minutes.** See "Automatic rollback" above for exactly what it covers and
  what it does not — it is not a standing subscriber to the alarms, and a manual deploy
  made outside `.github/workflows/cd.yml` is not covered by it.

## Contacts

- Primary on-call: see PagerDuty rotation.
- Secondary on-call: see PagerDuty rotation.
- Security lead: see `INCIDENT_PROCESS.md`.
- Escalation for data-layer issues: database owner.
