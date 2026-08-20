// CE-03 Term Planner executor factory — Stage 35.
//
// Returns a StepExecutor that drives the CE-03 Term Planner agent:
//   1. Parses CE03Input from context.input.
//   2. Opens a tenant-scoped read transaction and loads ALL constitution rows.
//   3. Passes CAPS_CANON rows (grade framework), ATP_CALENDAR rows (ATP schedule), and
//      ASSESSMENT_POLICY rows (assessment task rules) to the gateway.
//   4. Calls the Model Gateway with the CE-03 prompt body and the combined L0 documents.
//   5. Parses and validates the response as TermPlanResult.
//
// The executor never contains learner data. CAPS, ATP, and assessment policy documents are
// ratified government/school materials; the provenance stamp asserts the content was checked
// and contains no PII to de-identify.
//
// `withTenant`, `listConstitution`, `gatewayCall`, and `promptBody` are injected for
// unit-testability without a real database or gateway.

import {
  CE03Input,
  ChatCompletionRequest,
  TermPlanResult,
  type ChatCompletionResponse,
} from '@infinite-ai/contracts';
import type { TenantClient } from '@infinite-ai/db';

import type { ListConstitutionFn, StepExecutionContext } from './l0-gate-executor.js';
import { CurriculumSeedError } from './types.js';

export type WithCE03TenantFn = (
  ctx: { tenantId: string; actorId: string },
  fn: (tx: TenantClient) => Promise<TermPlanResult>,
) => Promise<TermPlanResult>;

export type CE03GatewayCallFn = (
  request: ChatCompletionRequest,
) => Promise<ChatCompletionResponse>;

/**
 * Provenance stamp for curriculum-only requests (no learner data).
 * CAPS, ATP, and assessment policy documents are ratified government materials — the
 * de-identification check runs and finds nothing to scrub; this stamp records that fact.
 */
const CURRICULUM_PROVENANCE = {
  deidentified: true as const,
  saltVersion: 0,
  dropped: [] as string[],
};

/**
 * Returns a StepExecutor for the `plan-term` pipeline step (CE-03).
 * Reads ratified CAPS_CANON, ATP_CALENDAR, and ASSESSMENT_POLICY rows from L0, calls
 * the gateway with the CE-03 prompt, and returns a validated TermPlanResult.
 *
 * Throws `CurriculumSeedError` when:
 * - The input does not conform to `CE03Input`.
 * - The gateway response cannot be parsed as `TermPlanResult`.
 */
export function makeCE03Executor(
  withTenant: WithCE03TenantFn,
  listConstitution: ListConstitutionFn,
  gatewayCall: CE03GatewayCallFn,
  promptBody: string,
): (context: StepExecutionContext) => Promise<TermPlanResult> {
  return async (context: StepExecutionContext): Promise<TermPlanResult> => {
    const parsed = CE03Input.safeParse(context.input);
    if (!parsed.success) {
      throw new CurriculumSeedError(
        `CE-03 received invalid input: ${parsed.error.message}`,
      );
    }
    const { tenantId, grade, subjects, termNumber, academicYear } = parsed.data;

    return withTenant({ tenantId, actorId: 'ce03-executor' }, async (tx) => {
      const constitution = await listConstitution(tx);
      // CE-03 needs:
      //   CAPS_CANON       — the GradeFramework (CE-01 source)
      //   ATP_CALENDAR     — the ATP schedule (CE-02 source, pacing by term)
      //   ASSESSMENT_POLICY — task kinds and scheduling rules
      const l0Documents = constitution.filter(
        (r) =>
          r.kind === 'CAPS_CANON' ||
          r.kind === 'ATP_CALENDAR' ||
          r.kind === 'ASSESSMENT_POLICY',
      );

      const request = ChatCompletionRequest.parse({
        tenantId,
        module: 'MOD-01',
        agent: 'CE-03',
        model: 'curriculum.plan',
        messages: [
          { role: 'system', content: promptBody },
          {
            role: 'user',
            content: JSON.stringify({
              input: { grade, subjects, termNumber, academicYear, tenantId },
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
          `CE-03: gateway response was not valid JSON: ${response.message.content.slice(0, 120)}`,
        );
      }

      const result = TermPlanResult.safeParse(rawOutput);
      if (!result.success) {
        throw new CurriculumSeedError(
          `CE-03: gateway response did not conform to TermPlanResult: ${result.error.message}`,
        );
      }
      return result.data;
    });
  };
}
