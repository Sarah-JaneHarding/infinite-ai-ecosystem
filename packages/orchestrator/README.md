# @infinite-ai/orchestrator

DAG definitions, the durable runner, human-in-the-loop gates, and compensation. This is
where rule 6 ("human-in-the-loop gates cannot be bypassed in production") actually lives
in code, and where a pipeline run survives a process restart because nothing it needs is
kept only in memory between steps.

## What's here

- `dag.ts` — `PipelineDefinition` / `PipelineStep`, a typed DAG of steps (agent call,
  tool call, human gate, branch, map-over-collection, compensation).
  `validatePipelineDag()` checks its own structural integrity (every reference resolves,
  no cycle in the forward graph); `validatePipelineGating()` checks that an irreversible
  tool sits behind a human gate.
- `run-state-machine.ts` — the pure decision logic a run's lifecycle needs: retry delay
  with jitter (`computeRetryDelayMs`), timeout detection (`hasTimedOut`), the next step
  after a success (`nextStepAfterSuccess`), and which compensations a failure triggers,
  in what order (`compensationChain`).
- `runner.ts` — `startRun()` / `advanceRun()` / `decideHumanGate()` /
  `runToCompletion()`: the imperative shell that persists every decision through
  `@infinite-ai/db` and actually calls out to execute a step. The approval record for a
  human gate exists in the database _before_ the guarded transition commits — there is
  no flag or env var that skips it.
- `concurrency.ts` / `fairness.ts` — per-tenant concurrency limits and fair scheduling
  across tenants competing for the same budget.
- `inspector.ts` — `inspectRun()`, the read model behind the Run Inspector surface
  (`/platform/runs` in `apps/web`).
- `pipelines/` — the real pipeline definitions for each module (`MOD01_CURRICULUM_PIPELINE`,
  the three MOD-02 pipelines, `MOD03_WAREHOUSE_PIPELINE`, `MOD04_TOOLBOX_PIPELINE`, the two
  MOD-05 pipelines, and the five Learning Engine pipelines).
- `export/dispatcher.ts` — `dispatchExport()`, routing a finished artefact to its
  renderer and publisher.

## Where it fits

L6 (the agent runtime) in the `CLAUDE.md` architecture. `packages/agents` declares what
an agent needs; this package is what actually runs one, step by step, durably.

## Running its tests

```bash
pnpm --filter @infinite-ai/orchestrator test               # unit tier
pnpm --filter @infinite-ai/orchestrator test:integration     # Postgres-backed durability
```
