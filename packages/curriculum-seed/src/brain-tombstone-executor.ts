// brain.tombstone_curriculum_version executor factory — Stage 32.
//
// Returns a StepExecutor (compensation step) that tombstones a curriculum L1_NODE that
// was written by brain.publish_curriculum_version, used when a later pipeline step fails
// after the publish has already committed.
//
// `reason` is hardcoded to `'pipeline_compensation'` — this is not a POPIA-driven
// tombstone, it is a pipeline rollback. The factory injects `withTenant` and `forgetFn`
// for unit-testability.

import {
  CurriculumTombstoneInput,
  CurriculumTombstoneResult,
} from '@infinite-ai/contracts';
import type { TenantClient, TombstonedBrainFact } from '@infinite-ai/db';

import type { StepExecutionContext } from './l0-gate-executor.js';
import { CurriculumSeedError } from './types.js';

export type WithTombstoneTenantFn = (
  ctx: { tenantId: string; actorId: string },
  fn: (tx: TenantClient) => Promise<CurriculumTombstoneResult>,
) => Promise<CurriculumTombstoneResult>;

/** Pre-bound to `targetTier: 'L1_NODE'` and `reason: 'pipeline_compensation'`. */
export type ForgetFn = (tx: TenantClient, id: string) => Promise<TombstonedBrainFact>;

/**
 * Returns a StepExecutor for the brain.tombstone_curriculum_version compensation step.
 * Parses `CurriculumTombstoneInput`, opens a tenant-scoped transaction, calls `forgetFn`
 * on the published L1_NODE, and returns the tombstone id and the superseded node id.
 *
 * Throws `CurriculumSeedError` if the input is invalid.
 */
export function makeTombstoneCurriculumVersionExecutor(
  withTenant: WithTombstoneTenantFn,
  forgetFn: ForgetFn,
): (context: StepExecutionContext) => Promise<CurriculumTombstoneResult> {
  return async (context: StepExecutionContext): Promise<CurriculumTombstoneResult> => {
    const parsed = CurriculumTombstoneInput.safeParse(context.input);
    if (!parsed.success) {
      throw new CurriculumSeedError(
        `brain.tombstone_curriculum_version received invalid input: ${parsed.error.message}`,
      );
    }
    const { tenantId, brainFactId } = parsed.data;

    return withTenant({ tenantId, actorId: 'brain-tombstone-executor' }, async (tx) => {
      const result = await forgetFn(tx, brainFactId);
      return CurriculumTombstoneResult.parse({
        tombstoneId: result.id,
        supersedes: result.supersedes,
      });
    });
  };
}
