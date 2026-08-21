// CE-05 Lesson Plan Generator executor factory — Stage 37.
//
// Returns a StepExecutor that drives the CE-05 Lesson Plan Generator agent:
//   1. Parses CE05Input from context.input.
//   2. Opens a tenant-scoped read transaction.
//   3. Loads CAPS_CANON rows (GradeFramework source) and TEMPLATE rows (template definitions)
//      from constitution.
//   4. Retrieves the ratified UnitBlueprint for the grade/subject/week from the Brain artefact store.
//   5. Calls the Model Gateway with the CE-05 prompt, L0 documents, and the UnitBlueprint.
//   6. Parses and validates the response as LessonPlanResult.
//
// CE-05 needs:
//   - CAPS_CANON rows (the GradeFramework source — success criteria must trace here)
//   - TEMPLATE rows (the school's lesson plan template definitions)
//   - The UnitBlueprint artefact from CE-04 (success criteria and evidence types)
//
// The executor never contains learner data. CAPS documents and template definitions are
// school curriculum materials; the provenance stamp asserts the content was checked
// and contains no PII to de-identify.
//
// `withTenant`, `listConstitution`, `getUnitBlueprint`, `gatewayCall`, and `promptBody`
// are injected for unit-testability without a real database or gateway.

import {
  CE05Input,
  ChatCompletionRequest,
  type ChatCompletionResponse,
  LessonPlanResult,
  type UnitBlueprint,
} from '@infinite-ai/contracts';
import type { TenantClient } from '@infinite-ai/db';

import type { ListConstitutionFn, StepExecutionContext } from './l0-gate-executor.js';
import { CurriculumSeedError } from './types.js';

export type WithCE05TenantFn = (
  ctx: { tenantId: string; actorId: string },
  fn: (tx: TenantClient) => Promise<LessonPlanResult>,
) => Promise<LessonPlanResult>;

/**
 * Retrieves the ratified UnitBlueprint for a given grade, subject, term, and week.
 * Returns null when no ratified blueprint exists yet (CE-04 has not been run and approved).
 */
export type GetUnitBlueprintFn = (
  tx: TenantClient,
  params: {
    grade: string;
    subject: string;
    termNumber: number;
    weekNumber: number;
    academicYear: number;
  },
) => Promise<UnitBlueprint | null>;

export type CE05GatewayCallFn = (
  request: ChatCompletionRequest,
) => Promise<ChatCompletionResponse>;

/**
 * Provenance stamp for curriculum-only requests (no learner data).
 * CAPS documents and lesson plan templates are school curriculum materials — the
 * de-identification check runs and finds nothing to scrub; this stamp records that fact.
 */
const CURRICULUM_PROVENANCE = {
  deidentified: true as const,
  saltVersion: 0,
  dropped: [] as string[],
};

/**
 * Returns a StepExecutor for the `generate-lesson-plan` pipeline step (CE-05).
 * Reads ratified CAPS_CANON and TEMPLATE rows from L0, retrieves the ratified UnitBlueprint
 * from the Brain artefact store, calls the gateway with the CE-05 prompt, and returns a
 * validated LessonPlanResult.
 *
 * Throws `CurriculumSeedError` when:
 * - The input does not conform to `CE05Input`.
 * - The gateway response cannot be parsed as `LessonPlanResult`.
 */
export function makeCE05Executor(
  withTenant: WithCE05TenantFn,
  listConstitution: ListConstitutionFn,
  getUnitBlueprint: GetUnitBlueprintFn,
  gatewayCall: CE05GatewayCallFn,
  promptBody: string,
): (context: StepExecutionContext) => Promise<LessonPlanResult> {
  return async (context: StepExecutionContext): Promise<LessonPlanResult> => {
    const parsed = CE05Input.safeParse(context.input);
    if (!parsed.success) {
      throw new CurriculumSeedError(
        `CE-05 received invalid input: ${parsed.error.message}`,
      );
    }
    const { tenantId, grade, subject, weekNumber, termNumber, academicYear, templateId } =
      parsed.data;

    return withTenant({ tenantId, actorId: 'ce05-executor' }, async (tx) => {
      const constitution = await listConstitution(tx);
      // CE-05 needs:
      //   CAPS_CANON — the GradeFramework (success criteria must trace here)
      //   TEMPLATE   — the school's lesson plan template definitions (agent uses templateId
      //                to pick the matching one from context.l0Documents)
      const l0Documents = constitution.filter(
        (r) => r.kind === 'CAPS_CANON' || r.kind === 'TEMPLATE',
      );

      const unitBlueprint = await getUnitBlueprint(tx, {
        grade,
        subject,
        termNumber,
        weekNumber,
        academicYear,
      });

      const request = ChatCompletionRequest.parse({
        tenantId,
        module: 'MOD-01',
        agent: 'CE-05',
        model: 'curriculum.lessons',
        messages: [
          { role: 'system', content: promptBody },
          {
            role: 'user',
            content: JSON.stringify({
              input: {
                grade,
                subject,
                weekNumber,
                termNumber,
                academicYear,
                tenantId,
                templateId,
              },
              context: { l0Documents, unitBlueprint },
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
          `CE-05: gateway response was not valid JSON: ${response.message.content.slice(0, 120)}`,
        );
      }

      const result = LessonPlanResult.safeParse(rawOutput);
      if (!result.success) {
        throw new CurriculumSeedError(
          `CE-05: gateway response did not conform to LessonPlanResult: ${result.error.message}`,
        );
      }
      return result.data;
    });
  };
}
