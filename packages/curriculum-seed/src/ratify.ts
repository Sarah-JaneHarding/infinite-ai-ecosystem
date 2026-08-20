// Stage 30 — curriculum ratification helper.
//
// Takes every L0_CONSTITUTION write candidate that is AWAITING_RATIFICATION for a tenant
// and drives it through to RETENTION_SCHEDULED via the Brain API's `ratify()`. After this
// runs, `listEffectiveConstitution()` returns the committed records and CE-01 can retrieve
// real curriculum content.
//
// Called from `scripts/ratify-curriculum.ts` and the integration test tier.

import { listOpenBrainWrites } from '@infinite-ai/db';
import type { TenantClient } from '@infinite-ai/db';
import { ratify } from '@infinite-ai/brain';

export interface RatifyResult {
  readonly ratified: number;
  readonly ids: readonly string[];
}

/**
 * Ratifies every L0_CONSTITUTION candidate that is currently AWAITING_RATIFICATION for
 * the given tenant, then drives each through to RETENTION_SCHEDULED.
 *
 * Candidates at any other status, or on any other tier, are left untouched. The function
 * is safe to call repeatedly — a second call with no pending candidates returns
 * `{ ratified: 0, ids: [] }`.
 */
export async function ratifyCurriculumForTenant(
  tx: TenantClient,
  ratifiedBy: string,
  now: Date = new Date(),
): Promise<RatifyResult> {
  const allOpen = await listOpenBrainWrites(tx);
  const pending = allOpen.filter(
    (c) => c.status === 'AWAITING_RATIFICATION' && c.targetTier === 'L0_CONSTITUTION',
  );
  const ids: string[] = [];
  for (const candidate of pending) {
    await ratify(tx, candidate.id, ratifiedBy, now);
    ids.push(candidate.id);
  }
  return { ratified: ids.length, ids };
}
