// CE-08 Differentiation Agent executor factory — Stage 40.
//
// Returns a StepExecutor that drives the CE-08 Differentiation Agent:
//   1. Parses CE08Input from context.input.
//   2. Opens a tenant-scoped read transaction.
//   3. Concurrently retrieves the ratified GradeFramework (CE-01) and the ratified
//      LessonPlan (CE-05) from the Brain artefact store.
//   4. Calls the Model Gateway with the CE-08 prompt, the GradeFramework, and the LessonPlan.
//   5. Parses and validates the response as DifferentiationResult.
//
// CE-08 does not need any constitution rows — it works entirely from two Brain artefacts:
//   - context.framework   — GradeFramework from CE-01 (modifications must trace here)
//   - context.lessonPlan  — LessonPlan from CE-05 (the base plan being differentiated)
//
// The executor never contains learner data. The GradeFramework and LessonPlan are
// curriculum planning materials; the provenance stamp records that no PII scrubbing is needed.
//
// `withTenant`, `getGradeFramework`, `getLessonPlan`, `gatewayCall`, and `promptBody`
// are injected for unit-testability without a real database or gateway.

import {
  CE08Input,
  ChatCompletionRequest,
  DifferentiationResult,
  type ChatCompletionResponse,
  type LessonPlan,
} from '@infinite-ai/contracts';
import type { TenantClient } from '@infinite-ai/db';

import type { GetGradeFrameworkFn } from './ce06-executor.js';
import type { StepExecutionContext } from './l0-gate-executor.js';
import { CurriculumSeedError } from './types.js';

export type WithCE08TenantFn = (
  ctx: { tenantId: string; actorId: string },
  fn: (tx: TenantClient) => Promise<DifferentiationResult>,
) => Promise<DifferentiationResult>;

/**
 * Retrieves the ratified LessonPlan for a given grade, subject, week, term, and
 * academic year from the Brain artefact store.
 * Returns null when no ratified lesson plan exists yet (CE-05 has not been run and approved).
 */
export type GetLessonPlanFn = (
  tx: TenantClient,
  params: {
    grade: string;
    subject: string;
    weekNumber: number;
    termNumber: number;
    academicYear: number;
  },
) => Promise<LessonPlan | null>;

export type CE08GatewayCallFn = (
  request: ChatCompletionRequest,
) => Promise<ChatCompletionResponse>;

// Re-export so callers can wire the same getter without touching ce06-executor directly.
export type { GetGradeFrameworkFn };

/**
 * Provenance stamp for curriculum-only requests (no learner data).
 * GradeFramework and LessonPlan are school curriculum planning materials — the
 * de-identification check runs and finds nothing to scrub; this stamp records that fact.
 */
const CURRICULUM_PROVENANCE = {
  deidentified: true as const,
  saltVersion: 0,
  dropped: [] as string[],
};

/**
 * Returns a StepExecutor for the `differentiate-lessons` pipeline step (CE-08).
 * Retrieves the ratified GradeFramework and LessonPlan from the Brain artefact store,
 * calls the gateway with the CE-08 prompt, and returns a validated DifferentiationResult.
 *
 * Throws `CurriculumSeedError` when:
 * - The input does not conform to `CE08Input`.
 * - The gateway response cannot be parsed as `DifferentiationResult`.
 */
export function makeCE08Executor(
  withTenant: WithCE08TenantFn,
  getGradeFramework: GetGradeFrameworkFn,
  getLessonPlan: GetLessonPlanFn,
  gatewayCall: CE08GatewayCallFn,
  promptBody: string,
): (context: StepExecutionContext) => Promise<DifferentiationResult> {
  return async (context: StepExecutionContext): Promise<DifferentiationResult> => {
    const parsed = CE08Input.safeParse(context.input);
    if (!parsed.success) {
      throw new CurriculumSeedError(
        `CE-08 received invalid input: ${parsed.error.message}`,
      );
    }
    const { tenantId, grade, subject, weekNumber, termNumber, academicYear, tiers } =
      parsed.data;

    return withTenant({ tenantId, actorId: 'ce08-executor' }, async (tx) => {
      const [gradeFramework, lessonPlan] = await Promise.all([
        getGradeFramework(tx, { grade, academicYear }),
        getLessonPlan(tx, { grade, subject, weekNumber, termNumber, academicYear }),
      ]);

      const request = ChatCompletionRequest.parse({
        tenantId,
        module: 'MOD-01',
        agent: 'CE-08',
        model: 'curriculum.differentiate',
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
                tiers,
              },
              context: { framework: gradeFramework, lessonPlan },
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
          `CE-08: gateway response was not valid JSON: ${response.message.content.slice(0, 120)}`,
        );
      }

      const result = DifferentiationResult.safeParse(rawOutput);
      if (!result.success) {
        throw new CurriculumSeedError(
          `CE-08: gateway response did not conform to DifferentiationResult: ${result.error.message}`,
        );
      }
      return result.data;
    });
  };
}
