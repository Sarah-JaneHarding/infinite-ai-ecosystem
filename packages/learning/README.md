# @infinite-ai/learning

LE Learning Engine — tenant-local learning from teacher corrections, versioned exemplar
and prompt promotion, k-anonymity commons publication, TTL-based decay and revalidation,
and maturity reporting.

## What's here

- `pattern-miner.ts` / `outcome-attributor.ts` — `minePatterns()`/`attributeOutcomes()`,
  turning a cohort of teacher corrections into a candidate pattern with an attribution
  method, gated behind `OUTCOME_MIN_COHORT_SIZE`.
- `exemplar-curator.ts` / `prompt-evolver.ts` — `curateExemplars()` (gated behind
  `EXEMPLAR_MIN_COMPOSITE_SCORE`) and `evolvePrompt()` (gated behind
  `EVOLVER_MIN_CORRECTION_FREQUENCY`): deciding whether a mined pattern is strong enough
  to become a new exemplar or a prompt revision candidate.
- `eval-gatekeeper.ts` / `promotion-gate.ts` — `gateChallenger()` and
  `applyPromotionGate()`: whether a challenger clears the eval bar, and the composite
  decision (maturity, eval result, cohort size) to actually promote it.
- `ratification-surface.ts` / `promotion-log.ts` — `composeRatificationPackage()` for the
  human reviewer, and `PromotionLog`, the append-only record of every promotion decision.
- `decay-agent.ts` / `decay-revalidation.ts` — `assessPatternDecay()`/`runDecayCheck()`,
  the TTL-based staleness check that flags a pattern for revalidation before it's relied
  on again.
- `commons-publisher.ts` / `commons-registry.ts` — `decideCommonPublication()` and
  `publishToCommons()`, gated behind `@infinite-ai/contracts`'s
  `COMMONS_K_ANONYMITY_THRESHOLD` — a pattern is only shared across tenants once enough
  distinct tenants exhibit it.
- `maturity-report.ts` — `assignMaturityLevel()`, the per-agent maturity signal that
  feeds the promotion gate's decision.

## Where it fits

The L7 module directly implementing Stage 13's Learning Engine (LE-01 through LE-09).
Depends only on shared types from `@infinite-ai/contracts`
(`COMMONS_K_ANONYMITY_THRESHOLD`, `DecayReason`, `GatekeeperVerdict`,
`ExemplarCandidate`, ...) — as of this README, no application code (`apps/worker`,
`apps/gateway`, `apps/web`) calls into this package yet; `scripts/verify-stage.ts` is its
only real consumer today, running its test suite as part of a stage gate.

## Running its tests

```bash
pnpm --filter @infinite-ai/learning test
pnpm --filter @infinite-ai/learning test:coverage
```

Unit tier only, no external services required.
