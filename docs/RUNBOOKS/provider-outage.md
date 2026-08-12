# Provider outage

**RTO:** ≤ 5 minutes from detecting the outage to traffic routing to the next provider.
**RPO:** 0 — the gateway's in-flight retry and fallback are transparent; no request is lost.

**Status:** Written in Stage 04 (gateway failover implemented). Live drill in Stage 15.

## What the alert means

`agent_run_failure_burst` fires with `gateway.provider_fallback_total` showing the primary provider is unreachable or returning sustained errors. Typical triggers: an Anthropic or OpenAI API incident, a network partition between the worker subnet and the provider's endpoint, or a rogue cost-cap that exhausted the month's budget.

## Who owns it

On-call platform engineer.

## The first action

Check `apps/gateway` logs for the top error class:

- `503 / connection refused` → provider endpoint is down; confirm on the provider's status page.
- `429 Too Many Requests` → rate limit or budget cap hit; check the gateway's per-tenant quota logs.
- `401 Unauthorized` → key rotation needed (see secrets runbook).

## How to confirm the diagnosis

```bash
# Last 50 gateway error lines for the affected tenant
pnpm --filter @infinite-ai/gateway exec tsx src/cli/tail-errors.ts --tenant <id> --n 50
```

Check the provider's public status page. If the provider is confirmed down, the gateway's `DEFAULT_ROUTING_CONFIG` will have already started routing to the secondary provider (`openai`) after its `maxRetries` threshold.

## The fix

### Automatic (no action required in most cases)

The gateway's `RoutingConfig.providers` list is ordered by preference. After `maxRetries` consecutive failures on the primary, it rotates to the next provider automatically. Monitor `gateway.provider_fallback_total` to confirm the secondary is serving traffic.

### Manual override (if automatic fallback is not triggering)

1. Update `GATEWAY_PRIMARY_PROVIDER` in the environment secret to the secondary provider name.
2. Restart the gateway process.
3. Confirm `gateway.provider` attribute in new spans shows the secondary.

### When the primary recovers

1. Restore `GATEWAY_PRIMARY_PROVIDER` to the original value.
2. Restart the gateway.
3. Confirm no cost anomaly from double-billing during the outage window.

## How to verify recovery

- `gateway.provider_fallback_total` stops incrementing.
- `agent.run.success.total` recovers to baseline.
- `pnpm --filter @infinite-ai/gateway test` exits 0.

## What to record afterwards

- Provider, start time, end time, duration.
- Number of requests affected and rerouted.
- Whether the RTO target (≤ 5 minutes) was met.
- Entry in `docs/RUNBOOKS/drill-results/`.

## Which test would have caught this earlier

`pnpm --filter @infinite-ai/gateway test:chaos` — the chaos suite injects provider failures and asserts the fallback path activates within the expected retry window.
