# @infinite-ai/curriculum-seed

Loads ingested CAPS and ATP source data from `@infinite-ai/contracts` into
`@infinite-ai/brain`'s L0 constitution tier (`CAPS_CANON` and `ATP_CALENDAR` records),
so CE-01 and CE-02 can retrieve real curriculum content instead of an empty Brain.

## What's here

- `seed.ts` — `seedCurriculumFromContracts()`, the single entry point scripts, agent
  tools, and integration tests use to load all CAPS and ATP source data in one pass.
  Deliberately not idempotent: `remember()`'s write-path contradiction logic already
  handles re-ingestion, so callers should not guard against duplicate runs.
- `ratify.ts` — `ratifyCurriculumForTenant()`, driving every `AWAITING_RATIFICATION`
  L0 candidate through to `RETENTION_SCHEDULED` via the Brain API's `ratify()`. Called
  from `scripts/ratify-curriculum.ts` and the integration test tier.
- `caps.ts` / `atp.ts` / `all-caps-sources.ts` — building an `L0ConstitutionPayload` from
  a ratified CAPS or ATP source document.
- `apply-dbe-overlay.ts` — `applyDbeOverlay()`, cross-checking a seeded curriculum
  against the DBE time-allocation registry in `@infinite-ai/contracts`.
- `l0-gate-executor.ts` — `makeL0GateExecutor()`, an `@infinite-ai/orchestrator`
  `StepExecutor` factory that refuses to proceed (`L0NotReadyError`) if a tenant's L0
  constitution is still empty — dependency-injected so it's unit-testable without a real
  database.
- `ce01-executor.ts` … `ce09-executor.ts` — the real `StepExecutor` for each MOD-01
  curriculum agent (CE-01 through CE-09), each dependency-injected the same way.
- `brain-publish-executor.ts` / `brain-tombstone-executor.ts` — the executors behind
  publishing a new curriculum version to the Brain and tombstoning a superseded one.

## Where it fits

An L7 module bridging `@infinite-ai/contracts` (ratified source data) and
`@infinite-ai/brain` (L0) for MOD-01. `@infinite-ai/orchestrator`'s
`MOD01_CURRICULUM_PIPELINE` only declares the pipeline's step shape; `apps/worker`
(via `scripts/register-ce-executors.ts`) is what actually wires each step to the real
executor this package exports. `apps/web`'s `/api/caps-canon` routes call into this
package directly for the CAPS-canon ingest/ratify admin surface.

## Running its tests

```bash
pnpm --filter @infinite-ai/curriculum-seed test
pnpm --filter @infinite-ai/curriculum-seed test:watch
```

Unit tier — every executor's real dependencies (gateway calls, `TenantClient`) are
injected as fakes, so no Docker or model call is needed.
