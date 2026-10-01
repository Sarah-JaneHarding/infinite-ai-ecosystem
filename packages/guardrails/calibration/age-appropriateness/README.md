# Age-appropriateness judge — labelled set (seed)

**These are not human labels.** Every case is `labelledBy: "constructed"` — written from the
clause text — and starts `review.status: "unreviewed"`. OQ-016 needs 50+ _human_-labelled
cases; this set is the material for that review, not a substitute for it. Nothing here scores a
judge, and no agreement threshold is set: that is the school's decision.

## What is here

- `cases.json` — 31 cases: for each of 14 clauses a **violation** (expected `appropriate: false`)
  and a **conformant** twin on the same topic (expected `true`), plus 3 **controls** for the
  judge's contract: empty clauses → `true`; a concern no clause covers → `true`; empty output →
  `false`. The twin matters: a judge that fails everything would pass every violation.
- `coverage.json` — which clauses are `tested`, which are `ambiguous` (and why), and which
  `conflict`. A clause in none of the three is **not yet classified**, not "descriptive" — nobody
  has said so. Of the 206, 14 are tested, 3 flagged ambiguous, 2 flagged conflicting (jigsaw
  benchmarks 026 vs 051 disagree on piece counts; neither is relied on).
- `../../src/age-appropriateness-labelled-set.ts` — the schema and `checkLabelledSet`, which a
  test runs against the real 206 clauses (every cited clause exists, is of the case's phase, and is
  paired).

## How a case is meant to be run

`clauseSet: "phase"`: give the judge **every** clause of the case's `phase` (as production does —
`recall` is phase-level) and `output` as the content. `clauseSet: "empty"`: give it none.

## Reviewing (what turns this into evidence)

For each case a person who knows the CAPS documents reads `construction` and the cited clause and
sets `review` to `confirmed`, `relabelled` (change `expectedAppropriate`, say why in `note`) or
`disputed`. `reviewer` and `reviewedOn` are required once the status is not `unreviewed`.
Only confirmed or relabelled cases count towards OQ-016's 50.
Cases for the remaining clauses are for the reviewer to add; this set does not guess which of
them are testable.
