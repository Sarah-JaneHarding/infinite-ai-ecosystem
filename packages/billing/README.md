# @infinite-ai/billing

Subscription tiers, per-tenant metering, invoicing, dunning, and telemetry
reconciliation.

## What's here

- `tiers.ts` — `SUBSCRIPTION_TIERS`/`getTier()` (Starter / Professional / Enterprise, per
  `docs/COST_MODEL.md`).
- `metering.ts` — `aggregateMeteringEvents()`/`computeOverage()`: turns raw usage events
  into a `PeriodUsage` and an `OverageBreakdown` against the tenant's tier.
- `reconciliation.ts` — `reconcilePeriod()`, checking metered usage against
  `@infinite-ai/telemetry`'s own recorded usage within `DEFAULT_TOLERANCE_PCT`, so
  billing and observability data don't silently drift apart.
- `invoicing.ts` — `buildInvoice()`, applying `VAT_RATE` (15%) to produce the line items
  and total for a billing period.
- `dunning.ts` — `applyDunningTrigger()`/`initialiseDunning()`, the escalation state
  machine (`GRACE_PERIOD_DAYS` → `SUSPENSION_THRESHOLD_DAYS` → terminal) for an overdue
  account.

## Where it fits

An L7 module from the same Stage 17 body of work as `@infinite-ai/provisioning`'s
tenant lifecycle. `dunning.ts`'s own `DunningState` machine (`PAYMENT_DUE` → `OVERDUE` →
`SUSPENDED`/`CLOSED`/`PAID`) mirrors `provisioning`'s `TenantStatus` names, but as of
this README neither package imports the other — nothing in code actually drives a
lifecycle transition from a dunning escalation yet, despite the two state machines
clearly being designed to work together.

## Running its tests

```bash
pnpm --filter @infinite-ai/billing test
pnpm --filter @infinite-ai/billing test:reconcile   # reconciliation.spec.ts specifically
```

Unit tier only, no external services required.
