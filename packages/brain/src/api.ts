// The Brain API — Stage 05 step 9.
//
// Every prior step built one piece of the Brain (the five tiers, the write path,
// contradiction resolution, the retrieval path, provenance, forgetting); this module is
// the one surface the manual asks for a caller outside `packages/brain` to actually use:
// "typed functions, not free-form SQL": `remember()`, `recall()`, `ratify()`,
// `supersede()`, `forget()`, `explain()`. Nothing here does new work — each function is a
// thin composition of what steps 1-8 already built and proved; this file is only the
// facade.
//
// `remember()` and `supersede()` both submit a candidate and drive it through the same
// write path (`openWrite` + `run`); the difference is what each asserts about the
// outcome. `remember()` is neutral — the pipeline decides whether the new fact conflicts
// with anything and, if so, how. `supersede()` is a caller's explicit claim that this
// candidate *replaces* a specific existing fact, and it is a caller bug — not something to
// swallow — if the result does not bear that out.
//
// `ratify()` here is `write-path.ts`'s own `ratify` (record who ratified an
// `L0_CONSTITUTION`/`L3_PROCEDURE` candidate, and when) followed by `run()`: once a human
// has ratified a candidate there is nothing left for it to wait on, so the Brain API's
// `ratify()` finishes the job rather than leaving a caller to remember a second call. The
// lower-level, record-only `ratify` remains importable directly from `./write-path.js` for
// a caller that genuinely wants the two steps apart (a worker recording a decision now and
// committing it later via `advanceOnce`/`run`, the same resumability `write-path.ts`'s own
// header describes).
//
// `forget()` wraps `@infinite-ai/db`'s `tombstoneBrainFact` under the manual's own name —
// see that module's header for why a tombstone is a distinct mechanism from the write
// path, not a correction routed through it.
//
// `explain()` walks `getFactProvenance`'s `supersedes` link backward from a given fact to
// the row with none — the provenance chain, newest first, that step 6's own header already
// named this step as the eventual walker of.

import {
  getFactProvenance,
  tombstoneBrainFact,
  type BrainTargetTier,
  type BrainWriteCandidateInput,
  type BrainWriteCandidateRow,
  type FactProvenance,
  type TenantClient,
  type TombstoneReason,
  type TombstoneTargetTier,
  type TombstonedBrainFact,
} from '@infinite-ai/db';
import { NOOP_TRACER, type Tracer } from '@infinite-ai/telemetry';

import { retrieve, type RetrievalResult } from './retrieval-path.js';
import type { RetrievalQuery } from './retrieval-types.js';
import { openWrite, ratify as recordRatification, run } from './write-path.js';

export class BrainApiError extends Error {
  public override readonly name = 'BrainApiError';
  constructor(message: string) {
    super(message);
  }
}

/**
 * Submits a new fact and drives it through the write path as far as it can currently go:
 * to `RETENTION_SCHEDULED` for a tier that needs no ratification, or to
 * `AWAITING_RATIFICATION` for `L0_CONSTITUTION`/`L3_PROCEDURE`, where it waits for a human
 * — see `ratify()`. This is the only way a new fact enters the Brain; there is no second
 * path that skips extraction, contradiction-checking or provenance-stamping.
 */
export async function remember(
  tx: TenantClient,
  input: BrainWriteCandidateInput,
  now: Date = new Date(),
): Promise<BrainWriteCandidateRow> {
  const opened = await openWrite(tx, input);
  return run(tx, opened.id, now);
}

/**
 * Runs the retrieval path: intent routing, the policy/RBAC/purpose gate, vector and graph
 * search, episodic filtering, rerank, and token-budgeted assembly, in that fixed order.
 */
export async function recall(
  tx: TenantClient,
  query: RetrievalQuery,
  tracer: Tracer = NOOP_TRACER,
): Promise<RetrievalResult> {
  return retrieve(tx, query, tracer);
}

/**
 * Records a human's ratification of an `L0_CONSTITUTION`/`L3_PROCEDURE` candidate, then
 * drives it the rest of the way through the write path. Throws whatever the underlying
 * `write-path.ts` `ratify` throws for a candidate that is not `AWAITING_RATIFICATION`.
 */
export async function ratify(
  tx: TenantClient,
  candidateId: string,
  ratifiedBy: string,
  ratifiedAt: Date,
): Promise<BrainWriteCandidateRow> {
  await recordRatification(tx, candidateId, ratifiedBy, ratifiedAt);
  return run(tx, candidateId, ratifiedAt);
}

/**
 * Submits an explicit correction to an existing fact and drives it through the write path
 * exactly like `remember()` — the only difference is what happens afterwards: this
 * function asserts the result actually replaces something. It is a caller bug, surfaced
 * rather than swallowed, if a committed result turns out to have inserted a brand-new fact
 * instead (nothing effective matched what the candidate declared), or if contradiction
 * resolution left the existing fact in place or unresolved. A candidate still
 * `AWAITING_RATIFICATION` is returned as-is: whether it supersedes anything is only decided
 * once a human ratifies it (see `ratify()`).
 */
export async function supersede(
  tx: TenantClient,
  input: BrainWriteCandidateInput,
  now: Date = new Date(),
): Promise<BrainWriteCandidateRow> {
  const opened = await openWrite(tx, input);
  const result = await run(tx, opened.id, now);
  await assertSuperseded(tx, result);
  return result;
}

async function assertSuperseded(
  tx: TenantClient,
  candidate: BrainWriteCandidateRow,
): Promise<void> {
  switch (candidate.status) {
    case 'AWAITING_RATIFICATION':
      return;
    case 'CONTRADICTION_CHECKED':
      throw new BrainApiError(
        `Candidate ${candidate.id} did not supersede an existing fact: its conflict with ` +
          `${candidate.contradictionOf} was left unresolved, or resolved against it.`,
      );
    case 'COMMITTED':
    case 'INDEXED':
    case 'RETENTION_SCHEDULED': {
      if (candidate.committedRowId === null) {
        throw new BrainApiError(
          `Candidate ${candidate.id} reached ${candidate.status} with no committed row.`,
        );
      }
      const fact = await getFactProvenance(
        tx,
        candidate.targetTier,
        candidate.committedRowId,
      );
      if (fact === null || fact.supersedes === null) {
        throw new BrainApiError(
          `Candidate ${candidate.id} committed a new fact rather than superseding an ` +
            'existing one; nothing effective matched what it declared.',
        );
      }
      return;
    }
    case 'CANDIDATE':
    case 'EXTRACTED':
    case 'PROVENANCE_STAMPED':
      // Unreachable: `run()` only ever stops at a terminal status or at
      // AWAITING_RATIFICATION pending a human, never mid-pipeline.
      throw new BrainApiError(
        `Candidate ${candidate.id} stopped mid-pipeline at ${candidate.status}.`,
      );
  }
}

/**
 * Tombstones an existing `L1_NODE`/`L1_EDGE` fact — the manual's `forget()`. Not routed
 * through the write path at all: see `@infinite-ai/db`'s `tombstoneBrainFact` for why a
 * tombstone is its own mechanism, not a correction an agent is proposing.
 */
export async function forget(
  tx: TenantClient,
  targetTier: TombstoneTargetTier,
  id: string,
  reason: TombstoneReason,
  now: Date = new Date(),
): Promise<TombstonedBrainFact> {
  return tombstoneBrainFact(tx, { targetTier, id, reason }, now);
}

/**
 * The full provenance chain for any committed fact, newest first: the fact itself, then
 * whatever it superseded, then whatever *that* superseded, back to the row with no
 * `supersedes` at all. This is what makes the system auditable to a school — every fact a
 * retrieval surfaces can be walked back to its origin, who ratified or committed each
 * version, and why.
 *
 * Throws if `id` does not exist under `targetTier` in this tenant at all. Also throws if
 * the chain cycles back on itself — append-only writes should make that structurally
 * impossible, but a caller gets an error instead of an infinite loop if it ever happens.
 */
export async function explain(
  tx: TenantClient,
  targetTier: BrainTargetTier,
  id: string,
): Promise<readonly FactProvenance[]> {
  const chain: FactProvenance[] = [];
  const seen = new Set<string>();
  let currentId: string | null = id;
  while (currentId !== null) {
    if (seen.has(currentId)) {
      throw new BrainApiError(
        `Provenance chain for ${targetTier} ${id} cycles back to ${currentId}; refusing to loop.`,
      );
    }
    seen.add(currentId);
    const fact: FactProvenance | null = await getFactProvenance(
      tx,
      targetTier,
      currentId,
    );
    if (fact === null) {
      if (chain.length === 0) {
        throw new BrainApiError(`No ${targetTier} ${id} in this tenant.`);
      }
      break;
    }
    chain.push(fact);
    currentId = fact.supersedes;
  }
  return chain;
}
