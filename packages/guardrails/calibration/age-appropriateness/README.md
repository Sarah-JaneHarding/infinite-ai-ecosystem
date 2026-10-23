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

## Running it

```bash
pnpm age-appropriateness:calibrate                  # scores reviewed cases only
pnpm age-appropriateness:calibrate --out report.json
```

Needs a running gateway (`docs/DEV_SETUP.md`: Anthropic-only recipe) and a **real** Anthropic key
in the gateway's environment — the script itself reads no key. It sends each case through the
gateway as the production judge does, and prints raw agreement, a confusion table, per-kind
agreement, every disagreement with the judge's rationale, and which provider served the run.

- It sets **no pass mark**. What agreement is good enough is the school's decision.
- By default it scores only `confirmed`/`relabelled` cases, so until a person has reviewed the
  set it refuses to run. `--include-unreviewed` is a dry run, and the output then says plainly
  that it is **not calibration evidence**. `disputed` cases are never scored.
- A call that fails (gateway down, bad key, PII guard refusal) is reported as **no verdict**, not
  as a rejection — otherwise an outage would score as a correct catch on every violation case.
- Record the served model with the result and re-run when it changes (OQ-016).
- A reviewer who disagrees with a case sets `status: "relabelled"` and flips `expectedAppropriate`;
  that is the only way a violation may expect a pass.
