# @infinite-ai/brain

Infinite Brain memory service: the five memory tiers (L0 constitution, L1 nodes/edges,
L2 episodes, L3 exemplars, L4 working memory), the append-only write path, and the
retrieval path. L0–L3's tables live in `packages/db`, the same way every other
tenant-owned table does — this package builds the typed API and pipeline logic on top of
them.

## What's here

- `api.ts` — the six functions a caller outside this package is meant to use:
  `remember`, `recall`, `ratify`, `supersede`, `forget`, `explain`.
- `write-path-schemas.ts` / `write-path-state-machine.ts` / `write-path.ts` — extraction
  and typing, the pure transition order and contradiction decision, and the orchestrator
  that persists each transition through `packages/db`. Rule 11 ("nothing is destructively
  updated in the Brain") lives in the state machine: a fact is superseded with a new
  version, never `UPDATE`d in place.
- `retrieval-intent-router.ts` / `retrieval-policy-gate.ts` / `retrieval-rerank.ts` /
  `retrieval-assembly.ts` / `retrieval-path.ts` — the retrieval pipeline, in the build
  manual's own fixed stage order: route intent → gate by policy → rerank candidates →
  assemble a token-budgeted context from three fixed priority tiers (L0 constitution,
  then reranked L1/L2, then L3 exemplars).
- `working-memory.ts` — L4's Redis-shaped working memory; the one tier with no table of
  its own in `packages/db`.
- `forgetting.ts` — the pure retention decision and the thin orchestrator that tombstones
  what it decides has expired, reusing `packages/db`'s tombstone primitive.
- `curriculum-templates.ts` / `age-appropriateness.ts` — narrower selection/submission
  APIs over specific L3 exemplar categories (curriculum artefact templates, the
  developmental-readiness clauses the age-appropriateness judge grounds its verdict in).

## Where it fits

L4 in the `CLAUDE.md` architecture, directly above L3 (`packages/db`) and below L5 (the
guardrail plane) and L6 (the agent runtime) — every agent's grounding context is
assembled by this package's retrieval path before it ever reaches a prompt.

## Running its tests

```bash
pnpm --filter @infinite-ai/brain test               # unit tier, no Docker needed
pnpm --filter @infinite-ai/brain test:integration    # Testcontainers; real Postgres
pnpm --filter @infinite-ai/brain test:temporal       # the temporal-decay integration suite specifically
```
