# @infinite-ai/pd-journal

PD Journal — records individual educator professional-development activities, computes
CPTD (Continuing Professional Teacher Development) cycle progress, and produces the
`PdCycleSummary` shape `packages/compliance` consumes directly.

## What's here

- `types.ts` — `PdJournalEntry` (one activity: SACE activity type, claimed points,
  verification status) and `CycleProgress`, the computed view of a single educator's
  standing at a point in time.
- `journal.ts` — `computeCycleProgress()` (sums verified/pending points within a cycle
  window, excluding rejected entries) and `buildPdCycleSummary()` (aggregates many
  educators' progress into the `PdCycleSummary` shape). `resolveCycleYear()` maps a date
  to the educator's current year (1/2/3) of their three-year CPTD cycle, clamped at the
  cycle boundary.

## Where it fits

An L7 module supporting MOD-05 (Teaching Analytics & PD Studio). `PdCycleSummary` is
structurally compatible with `packages/compliance`'s `PdPointsInput` — only verified
points count for regulatory compliance; pending points never satisfy the requirement on
their own.

## Running its tests

```bash
pnpm --filter @infinite-ai/pd-journal test
```

Unit tier only, no external services required.
