// brain.publish_curriculum_version executor factory — Stage 32.
//
// Returns a StepExecutor that writes the CE-03..CE-08 curriculum artefact bundle to
// Brain L1_NODE after HoD approval. This is an "empty vessel" in the sense that `content`
// is typed as `unknown` until CE-08's output schema stabilises; the Brain write path
// accepts it as a raw payload and will carry the content through without full type
// extraction until that coupling is made.
//
// The factory injects `withTenant` and `rememberFn` so the executor is unit-testable
// without a real database or Brain instance.

import { CurriculumPublishInput, CurriculumPublishResult } from '@infinite-ai/contracts';
import type {
  BrainWriteCandidateInput,
  BrainWriteCandidateRow,
  TenantClient,
} from '@infinite-ai/db';

import type { StepExecutionContext } from './l0-gate-executor.js';
import { CurriculumSeedError } from './types.js';

export type WithPublishTenantFn = (
  ctx: { tenantId: string; actorId: string },
  fn: (tx: TenantClient) => Promise<CurriculumPublishResult>,
) => Promise<CurriculumPublishResult>;

export type RememberFn = (
  tx: TenantClient,
  input: BrainWriteCandidateInput,
) => Promise<BrainWriteCandidateRow>;

/**
 * Returns a StepExecutor for the brain.publish_curriculum_version pipeline step.
 * Parses `CurriculumPublishInput`, opens a tenant-scoped transaction, calls `rememberFn`
 * to write the curriculum bundle to Brain L1_NODE, and returns the committed node's id.
 *
 * Throws `CurriculumSeedError` if the input is invalid or the Brain write does not reach
 * `COMMITTED` status (i.e. `committedRowId` is null).
 */
export function makePublishCurriculumVersionExecutor(
  withTenant: WithPublishTenantFn,
  rememberFn: RememberFn,
): (context: StepExecutionContext) => Promise<CurriculumPublishResult> {
  return async (context: StepExecutionContext): Promise<CurriculumPublishResult> => {
    const parsed = CurriculumPublishInput.safeParse(context.input);
    if (!parsed.success) {
      throw new CurriculumSeedError(
        `brain.publish_curriculum_version received invalid input: ${parsed.error.message}`,
      );
    }
    const { tenantId, content, hodApprovalId } = parsed.data;

    return withTenant({ tenantId, actorId: 'brain-publish-executor' }, async (tx) => {
      const candidate = await rememberFn(tx, {
        targetTier: 'L1_NODE',
        rawPayload: content,
        source: `brain.publish_curriculum_version:${hodApprovalId}`,
        derivationRunId: context.runId,
      });

      const brainFactId = candidate.committedRowId;
      if (brainFactId === null) {
        throw new CurriculumSeedError(
          `brain.publish_curriculum_version: L1_NODE was not committed (status=${candidate.status}).`,
        );
      }

      return CurriculumPublishResult.parse({ brainFactId });
    });
  };
}
