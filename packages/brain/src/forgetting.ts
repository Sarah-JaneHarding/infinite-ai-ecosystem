// Forgetting by design — Stage 05 step 8.
//
// `packages/contracts/src/popia/retention.ts` (Stage 03) built the arithmetic — one pure
// function, `evaluateRetention`, that decides `retain` or `tombstone` for one record at
// one moment, against a ratified schedule that ships with no numbers in it (rule 11: the
// periods are each school's legal determination). Stage 03's own write-up is explicit
// about what that stage did not build: "the evaluation function is written and tested;
// the worker that runs it has nothing to run until a school ratifies a schedule" (OQ-007).
// The same is true here, for the same reason, and this module makes the same choice
// deliberately rather than by omission: `decideBrainRetention` is the pure decision,
// `sweepBrainRetention` is the thin orchestrator that acts on it, and neither is wired to
// a scheduler. There is still no ratified schedule for either function to run against in
// this environment, and inventing a cron job with nothing real to run would be exactly
// the kind of premature infrastructure Stage 15 (not this one) is where scheduling and
// operational concerns belong.
//
// What is new here, versus Stage 03's own version: `sweepBrainRetention` does not stop at
// deciding — it calls `@infinite-ai/db`'s `tombstoneBrainFact` for every `tombstone`
// verdict, so a caller that does have facts to check (however it assembled that list) gets
// the whole job, not just the answer.
//
// "Tombstone on consent withdrawal" reuses the exact same `tombstoneBrainFact` primitive,
// under `reason: 'consent_withdrawn'` instead of `'retention_expired'` — the mechanism does
// not care why a fact is being forgotten. What is not built here is the automatic trigger:
// cross-referencing `@infinite-ai/policy`'s `evaluateConsent` against which Brain facts
// belong to which subject token. Stage 03 left the equivalent sweep for its own tables
// unbuilt for the same reason ("the pieces exist... and the job that joins them is not
// written") — recorded in docs/STAGE_LOG.md as a stated follow-up, not silently assumed
// away.

import {
  evaluateRetention,
  type DataCategory,
  type RetentionAnchor,
  type RetentionSchedule,
} from '@infinite-ai/contracts';
import {
  tombstoneBrainFact,
  type TenantClient,
  type TombstoneTargetTier,
} from '@infinite-ai/db';

/** A committed L1_NODE/L1_EDGE fact, already resolved to the shape the retention
 * arithmetic needs. Assembling this list — which facts, with which anchor date — is the
 * caller's job; nothing here queries for it, the same boundary `assembleContext` draws
 * against candidates it is handed rather than fetching itself. */
export interface RetainableBrainFact {
  readonly id: string;
  readonly targetTier: TombstoneTargetTier;
  readonly subjectToken: string;
  readonly category: DataCategory;
  readonly anchor: RetentionAnchor;
  /** When the anchor event happened, or null if it has not happened yet. */
  readonly anchoredAt: Date | null;
}

export type RetentionSweepDecision =
  | { readonly fact: RetainableBrainFact; readonly action: 'tombstone' }
  | {
      readonly fact: RetainableBrainFact;
      readonly action: 'retain';
      readonly reason: string;
    };

/**
 * Pure: decides one verdict per fact against `schedule`, at `now`. No database, no side
 * effects — `sweepBrainRetention` below is what acts on the result.
 */
export function decideBrainRetention(
  schedule: RetentionSchedule,
  facts: readonly RetainableBrainFact[],
  now: Date,
): readonly RetentionSweepDecision[] {
  return facts.map((fact) => {
    const verdict = evaluateRetention(
      schedule,
      {
        subjectToken: fact.subjectToken,
        category: fact.category,
        anchor: fact.anchor,
        anchoredAt: fact.anchoredAt,
      },
      now,
    );
    if (verdict.action === 'tombstone') {
      return { fact, action: 'tombstone' };
    }
    return { fact, action: 'retain', reason: verdict.reason };
  });
}

export interface RetentionSweepResult {
  readonly tombstoned: readonly string[];
  readonly retained: readonly { readonly id: string; readonly reason: string }[];
}

/**
 * Runs `decideBrainRetention` and tombstones every fact it says has expired, in order.
 * Not idempotent across repeated calls with the same `facts` for a fact that was already
 * tombstoned by an earlier sweep — `tombstoneBrainFact` refuses that itself, and a caller
 * re-sweeping the same list is expected to have dropped what already left `facts`.
 */
export async function sweepBrainRetention(
  tx: TenantClient,
  schedule: RetentionSchedule,
  facts: readonly RetainableBrainFact[],
  now: Date,
): Promise<RetentionSweepResult> {
  const decisions = decideBrainRetention(schedule, facts, now);
  const tombstoned: string[] = [];
  const retained: { id: string; reason: string }[] = [];

  for (const decision of decisions) {
    if (decision.action === 'tombstone') {
      await tombstoneBrainFact(
        tx,
        {
          targetTier: decision.fact.targetTier,
          id: decision.fact.id,
          reason: 'retention_expired',
        },
        now,
      );
      tombstoned.push(decision.fact.id);
    } else {
      retained.push({ id: decision.fact.id, reason: decision.reason });
    }
  }

  return { tombstoned, retained };
}
