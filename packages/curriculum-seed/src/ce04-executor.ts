// CE-04 Unit Architect executor factory — Stage 36.
//
// Returns a StepExecutor that drives the CE-04 Unit Architect agent:
//   1. Parses CE04Input from context.input.
//   2. Opens a tenant-scoped read transaction.
//   3. Loads CAPS_CANON rows (GradeFramework source) from constitution.
//   4. Retrieves the ratified TermPlan for the grade/term/year from the Brain artefact store.
//   5. Calls the Model Gateway with the CE-04 prompt, CAPS_CANON documents, and the TermPlan.
//   6. Parses and validates the response as UnitBlueprintResult.
//
// Unlike CE-03, CE-04 does not need ATP_CALENDAR or ASSESSMENT_POLICY rows directly —
// those scheduling rules are already embedded in the TermPlan's assessmentCalendar entries
// (each citing the assessment policy by SourceRef). CE-04 needs:
//   - CAPS_CANON (the GradeFramework, to verify big ideas and content areas)
//   - The TermPlan artefact from CE-03 (to verify the content area appears in the term)
//
// The executor never contains learner data. CAPS documents are ratified government materials;
// the provenance stamp asserts the content was checked and contains no PII to de-identify.
//
// `withTenant`, `listConstitution`, `getTermPlan`, `gatewayCall`, and `promptBody` are
// injected for unit-testability without a real database or gateway.

import {
  CE04Input,
  ChatCompletionRequest,
  type ChatCompletionResponse,
  type TermPlan,
  UnitBlueprintResult,
} from '@infinite-ai/contracts';
import type { TenantClient } from '@infinite-ai/db';

import type { ListConstitutionFn, StepExecutionContext } from './l0-gate-executor.js';
import { CurriculumSeedError } from './types.js';

export type WithCE04TenantFn = (
  ctx: { tenantId: string; actorId: string },
  fn: (tx: TenantClient) => Promise<UnitBlueprintResult>,
) => Promise<UnitBlueprintResult>;

/**
 * Retrieves the most recently ratified TermPlan for a given grade, term, and year.
 * Returns null when no ratified plan exists yet (CE-03 has not been run and approved).
 */
export type GetTermPlanFn = (
  tx: TenantClient,
  params: { grade: string; termNumber: number; academicYear: number },
) => Promise<TermPlan | null>;

export type CE04GatewayCallFn = (
  request: ChatCompletionRequest,
) => Promise<ChatCompletionResponse>;

/**
 * Provenance stamp for curriculum-only requests (no learner data).
 * CAPS documents are ratified government materials — the de-identification check runs
 * and finds nothing to scrub; this stamp records that fact.
 */
const CURRICULUM_PROVENANCE = {
  deidentified: true as const,
  saltVersion: 0,
  dropped: [] as string[],
};

/**
 * Returns a StepExecutor for the `design-unit` pipeline step (CE-04).
 * Reads ratified CAPS_CANON rows from L0 and the ratified TermPlan from the Brain artefact
 * store, calls the gateway with the CE-04 prompt, and returns a validated UnitBlueprintResult.
 *
 * Throws `CurriculumSeedError` when:
 * - The input does not conform to `CE04Input`.
 * - The gateway response cannot be parsed as `UnitBlueprintResult`.
 */
export function makeCE04Executor(
  withTenant: WithCE04TenantFn,
  listConstitution: ListConstitutionFn,
  getTermPlan: GetTermPlanFn,
  gatewayCall: CE04GatewayCallFn,
  promptBody: string,
): (context: StepExecutionContext) => Promise<UnitBlueprintResult> {
  return async (context: StepExecutionContext): Promise<UnitBlueprintResult> => {
    const parsed = CE04Input.safeParse(context.input);
    if (!parsed.success) {
      throw new CurriculumSeedError(
        `CE-04 received invalid input: ${parsed.error.message}`,
      );
    }
    const { tenantId, grade, subject, termNumber, contentArea, academicYear } =
      parsed.data;

    return withTenant({ tenantId, actorId: 'ce04-executor' }, async (tx) => {
      const constitution = await listConstitution(tx);
      // CE-04 needs CAPS_CANON rows only from constitution (the GradeFramework source).
      // ATP_CALENDAR and ASSESSMENT_POLICY rules are already embedded in the TermPlan.
      const l0Documents = constitution.filter((r) => r.kind === 'CAPS_CANON');

      const termPlan = await getTermPlan(tx, { grade, termNumber, academicYear });

      const request = ChatCompletionRequest.parse({
        tenantId,
        module: 'MOD-01',
        agent: 'CE-04',
        model: 'curriculum.design',
        messages: [
          { role: 'system', content: promptBody },
          {
            role: 'user',
            content: JSON.stringify({
              input: { grade, subject, termNumber, contentArea, academicYear, tenantId },
              context: { l0Documents, termPlan },
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
          `CE-04: gateway response was not valid JSON: ${response.message.content.slice(0, 120)}`,
        );
      }

      const result = UnitBlueprintResult.safeParse(rawOutput);
      if (!result.success) {
        throw new CurriculumSeedError(
          `CE-04: gateway response did not conform to UnitBlueprintResult: ${result.error.message}`,
        );
      }
      return result.data;
    });
  };
}
