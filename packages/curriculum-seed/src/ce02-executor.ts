// CE-02 ATP Sequencer executor factory — Stage 34.
//
// Returns a StepExecutor that drives the CE-02 ATP Sequencer agent:
//   1. Parses CE02Input from context.input.
//   2. Opens a tenant-scoped read transaction and loads ALL constitution rows.
//   3. Passes CAPS_CANON rows (grade framework) AND ATP_CALENDAR rows (pacing) to the gateway.
//   4. Calls the Model Gateway with the CE-02 prompt body and the combined L0 documents.
//   5. Parses and validates the response as ATPResult.
//
// The executor never contains learner data. CAPS policy and ATP calendar documents are
// ratified government materials; the provenance stamp asserts the content was checked
// and contains no PII to de-identify.
//
// `withTenant`, `listConstitution`, `gatewayCall`, and `promptBody` are injected for
// unit-testability without a real database or gateway.

import {
  ATPResult,
  CE02Input,
  ChatCompletionRequest,
  type ChatCompletionResponse,
} from '@infinite-ai/contracts';
import type { TenantClient } from '@infinite-ai/db';

import type { ListConstitutionFn, StepExecutionContext } from './l0-gate-executor.js';
import { CurriculumSeedError } from './types.js';

export type WithCE02TenantFn = (
  ctx: { tenantId: string; actorId: string },
  fn: (tx: TenantClient) => Promise<ATPResult>,
) => Promise<ATPResult>;

export type CE02GatewayCallFn = (
  request: ChatCompletionRequest,
) => Promise<ChatCompletionResponse>;

/**
 * Provenance stamp for curriculum-only requests (no learner data).
 * Both CAPS and ATP documents are ratified government materials — the de-identification
 * check runs and finds nothing to scrub; this stamp records that fact.
 */
const CURRICULUM_PROVENANCE = {
  deidentified: true as const,
  saltVersion: 0,
  dropped: [] as string[],
};

/**
 * Returns a StepExecutor for the `sequence-atp` pipeline step (CE-02).
 * Reads ratified CAPS_CANON and ATP_CALENDAR rows from L0, calls the gateway with the
 * CE-02 prompt, and returns a validated ATPResult.
 *
 * Throws `CurriculumSeedError` when:
 * - The input does not conform to `CE02Input`.
 * - The gateway response cannot be parsed as `ATPResult`.
 */
export function makeCE02Executor(
  withTenant: WithCE02TenantFn,
  listConstitution: ListConstitutionFn,
  gatewayCall: CE02GatewayCallFn,
  promptBody: string,
): (context: StepExecutionContext) => Promise<ATPResult> {
  return async (context: StepExecutionContext): Promise<ATPResult> => {
    const parsed = CE02Input.safeParse(context.input);
    if (!parsed.success) {
      throw new CurriculumSeedError(
        `CE-02 received invalid input: ${parsed.error.message}`,
      );
    }
    const { tenantId, grade, subjects, academicYear, schoolCalendar } = parsed.data;

    return withTenant({ tenantId, actorId: 'ce02-executor' }, async (tx) => {
      const constitution = await listConstitution(tx);
      // CE-02 needs CAPS_CANON (the GradeFramework source) AND ATP_CALENDAR (the pacing docs).
      const l0Documents = constitution.filter(
        (r) => r.kind === 'CAPS_CANON' || r.kind === 'ATP_CALENDAR',
      );

      const request = ChatCompletionRequest.parse({
        tenantId,
        module: 'MOD-01',
        agent: 'CE-02',
        model: 'curriculum.sequence',
        messages: [
          { role: 'system', content: promptBody },
          {
            role: 'user',
            content: JSON.stringify({
              // schoolCalendar is undefined when absent; JSON.stringify omits undefined fields.
              input: { grade, subjects, academicYear, tenantId, schoolCalendar },
              context: { l0Documents },
            }),
          },
        ],
        temperature: 0,
        provenance: CURRICULUM_PROVENANCE,
      });

      const response = await gatewayCall(request);

      let rawOutput: unknown;
      try {
        rawOutput = JSON.parse(response.message.content) as unknown;
      } catch {
        throw new CurriculumSeedError(
          `CE-02: gateway response was not valid JSON: ${response.message.content.slice(0, 120)}`,
        );
      }

      const result = ATPResult.safeParse(rawOutput);
      if (!result.success) {
        throw new CurriculumSeedError(
          `CE-02: gateway response did not conform to ATPResult: ${result.error.message}`,
        );
      }
      return result.data;
    });
  };
}
