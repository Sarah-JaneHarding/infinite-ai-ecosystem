# @infinite-ai/analytics

MOD-02 Support Analytics Centre — the tier model and SIAS state machine. Both are pure,
synchronous modules: a score and data readings in, a tier or a transition verdict out. No
database, no model calls, no I/O — that is what makes "was this tier recommendation
justified by the data?" answerable after the fact without archaeology.

## What's here

- `tier-model.ts` — `assignTier()` against `DEFAULT_TIER_BANDS`, plus
  `checkDataSufficiency()`/`checkAllDomainsSufficiency()` across `SCREENING_DOMAINS` —
  a tier recommendation the data doesn't sufficiently support is a distinct verdict, not
  silently assigned anyway.
- `sias-state.ts` — `transitionSias()`, the legal-transition-only SIAS state machine
  (`LEGAL_TRANSITIONS`), `isSiasTerminal()`, and the `SiasTransitionAudit` every
  transition leaves.
- `agent-schemas.ts` — the `AC01Input`/`Result` … `AC11Input`/`Result` shapes for
  MOD-02's eleven agents, plus the shared domain types (`EarlyWarningSignal`,
  `InterventionDosage`, `MeetingDecisionRecord`, ...).
- `case-file.ts` — `buildCaseFile()`, assembling one learner's full SIAS case history
  from screening, tier, intervention, meeting, and progress entries.
- `reporting.ts` — `rollupClass()`/`rollupGrade()`/`rollupSchool()`, each enforcing
  `MIN_COHORT_SIZE` suppression before returning a distribution.
- `bias-monitor.ts` — `monitorBias()`, flagging a tier-assignment disparity across
  groups above `BIAS_RATIO_THRESHOLD` once a group clears
  `MIN_POPULATION_FOR_BIAS_CHECK`.

## Where it fits

The L7 module directly implementing MOD-02. `packages/agents/src/mod-02/`'s eleven
`AC-*.contract.ts` declarations and `scripts/register-ac-executors.ts` are its real
importers. `apps/worker/src/condition-evaluator.ts` doesn't import this package
directly, but its own comments describe the `ActiveInterventionItem`/`AC02Result` shapes
it expects at runtime as coming from here — a pipeline branch condition can depend on a
SIAS state or tier verdict this package computed, checked duck-typed rather than through
a static import.

## Running its tests

```bash
pnpm --filter @infinite-ai/analytics test
pnpm --filter @infinite-ai/analytics test:coverage
```

Unit tier only, no external services required.
