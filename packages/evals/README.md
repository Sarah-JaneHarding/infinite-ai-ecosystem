# @infinite-ai/evals

Golden sets, scorers, the champion/challenger runner, the safety set, and the growth
loop — the machinery behind Definition of Done's "adds an agent → an eval set of ≥ 20
cases" rule. That specific count is a reviewer-checked convention, not something this
package's code enforces; what it does enforce is that a case set validates against
`EvalCase`'s schema and that a promotion clears `decidePromotion()`'s bar.

## What's here

- `case.ts` — `EvalCase`/`Expectation`, `validateEvalCase()`, and `SAFETY_TAGS`
  (`MUST_NOT_REGRESS_TAG` marks a case a promotion can never fail without blocking).
- `scorers.ts` — one scorer per expectation kind: exact match, numeric tolerance, JSON
  schema, readability band, citation presence, refusal correctness, template fidelity,
  set overlap, and `scoreLlmJudge` for the cases nothing simpler can grade.
- `runner.ts` — `runEvalSet()` / `diffAgainstChampion()`: runs a case set against an
  `AgentExecutor` and diffs the result against the last champion run.
- `promotion.ts` / `gate.ts` — `decidePromotion()` and `evaluateGate()`: whether a
  challenger's scores clear the bar to become the new champion, and whether a PR's score
  gate passes at all.
- `discovery.ts` / `affected.ts` — `loadAllEvalSets()`, and `classifyChange()` /
  `affectedAgentIds()`, which decide which agents' eval sets a given diff needs to
  re-run.
- `agent-executors.ts` — the registry an agent registers its real (or stubbed) executor
  into, so `runEvalSet()` can call it without importing the agent runtime directly.
- `safety-set.ts` / `growth-loop.ts` — the safety-case subset every promotion must also
  pass, and the human-gated pipeline that turns a flagged real interaction into a new
  golden case.
- `champion-store.ts` / `dashboard.ts` — persisting the current champion result and
  building the per-agent score/cost history behind an eval dashboard.

## Where it fits

Stage 07 (eval harness and golden sets) in `docs/STAGE_LOG.md`. `packages/agents`'
`bootAgentRegistry()` can be given an `EvalSetExistenceCheck` backed by this package's
`loadAllEvalSets()`, so a promotion or a boot-time check could refuse to proceed against
an agent whose eval set doesn't exist — but no application code wires that check up yet.
Today the real entry point is `pnpm evals:gate` (`scripts/evals-gate.ts`, calling
`evaluateGate()`/`decidePromotion()`), run by hand or from a workflow a maintainer
triggers — it is not currently invoked by `.github/workflows/ci.yml` or
`scripts/verify-stage.ts` on every PR.

## Running its tests

```bash
pnpm --filter @infinite-ai/evals test
```

Unit tier only — scorers and the runner are exercised against fixture cases and stub
executors, not live model calls.
