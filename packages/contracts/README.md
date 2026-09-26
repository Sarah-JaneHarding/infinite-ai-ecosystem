# @infinite-ai/contracts

Zod schemas shared by the API, agents and UI. Three families of contract live here: the
POPIA vocabularies (purpose taxonomy, consent ledger, retention schedule), the CAPS
curriculum framework (including the ratified source documents each curriculum agent
grounds its output in), and the Model Gateway's OpenAI-compatible wire contract.

## Why contracts, not implementations

`packages/policy` decides, `packages/db` stores, and the modules (MOD-01 through MOD-05)
consume — and all three agree with each other only because each agrees with this
package, rather than with one another directly. A schema changing here is a breaking
change everywhere it's imported, which is deliberate: it is the thing that makes three
independently-written layers stay consistent.

## What's here

- `popia/` — `Purpose`, `ConsentEntry`, `RetentionSchedule`, and the functions that
  operationalise them (`permits`, `evaluateRetention`, `isWithdrawable`).
- `curriculum/` — the CAPS framework types (`CurriculumFramework`, `GradeFramework`,
  `Lesson`, `Rubric`, ...), the ratified source documents each subject/phase/grade
  combination is grounded in, and the DBE time-allocation registry.
- `policy/` — the ratified non-curriculum policy sources (SASA, BELA, SIAS, SACE Act, the
  WSE and PD-points schedules) that `packages/compliance` cites in every finding.
- `gateway/` — `ChatCompletionRequest`/`Response`, `DeidentificationProvenance`, and the
  other shapes that cross the Model Gateway boundary.
- `toolbox/`, `mod-05/`, `learning/` — the MOD-04, MOD-05, and Learning Engine agents'
  own input/output contracts.

## Where it fits

Every layer in the `CLAUDE.md` architecture diagram imports from here rather than
defining its own version of a shared shape — it is the thing that makes `packages/policy`,
`packages/db`, and the module packages agree on what a `Purpose` or a `Lesson` is, without
any of them depending on each other directly.

## Running its tests

```bash
pnpm --filter @infinite-ai/contracts test
pnpm --filter @infinite-ai/contracts test:coverage   # §4.2 thresholds enforced
```

Unit tier only, no external services required.
