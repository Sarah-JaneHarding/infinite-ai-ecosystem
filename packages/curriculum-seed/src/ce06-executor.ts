// CE-06 Assessment Designer executor factory — Stage 38.
//
// Returns a StepExecutor that drives the CE-06 Assessment Designer agent:
//   1. Parses CE06Input from context.input.
//   2. Opens a tenant-scoped read transaction.
//   3. Loads ASSESSMENT_POLICY rows from constitution.
//   4. Retrieves the ratified GradeFramework for the grade from the Brain artefact store.
//   5. Retrieves the ratified TermPlan for the grade/term/year from the Brain artefact store.
//   6. Calls the Model Gateway with the CE-06 prompt, assessment policy documents, the
//      GradeFramework, and the TermPlan.
//   7. Parses and validates the response as AssessmentTaskDesignResult.
//
// CE-06 needs three ratified sources (prompt requirement):
//   - context.framework     — GradeFramework from CE-01 (Brain artefact)
//   - context.termPlan      — TermPlan from CE-03 (Brain artefact)
//   - context.assessmentPolicy — ASSESSMENT_POLICY rows from L0 constitution
//
// The executor never contains learner data. All context documents are government/school
// curriculum policy materials; the provenance stamp records that no PII was found.
//
// `withTenant`, `listConstitution`, `getGradeFramework`, `getTermPlan`, `gatewayCall`,
// and `promptBody` are injected for unit-testability without a real database or gateway.

import {
  AssessmentTaskDesignResult,
  CE06Input,
  ChatCompletionRequest,
  type ChatCompletionResponse,
  type GradeFramework,
} from '@infinite-ai/contracts';
import type { TenantClient } from '@infinite-ai/db';

import type { GetTermPlanFn } from './ce04-executor.js';
import type { ListConstitutionFn, StepExecutionContext } from './l0-gate-executor.js';
import { CurriculumSeedError } from './types.js';

export type WithCE06TenantFn = (
  ctx: { tenantId: string; actorId: string },
  fn: (tx: TenantClient) => Promise<AssessmentTaskDesignResult>,
) => Promise<AssessmentTaskDesignResult>;

/**
 * Retrieves the ratified GradeFramework for a given grade and academic year.
 * Returns null when no ratified framework exists yet (CE-01 has not been run and approved).
 */
export type GetGradeFrameworkFn = (
  tx: TenantClient,
  params: { grade: string; academicYear: number },
) => Promise<GradeFramework | null>;

export type CE06GatewayCallFn = (
  request: ChatCompletionRequest,
) => Promise<ChatCompletionResponse>;

// Re-export so callers can wire the same getter without touching ce04-executor.
export type { GetTermPlanFn };

/**
 * Provenance stamp for curriculum-only requests (no learner data).
 * Assessment policy and GradeFramework documents are school/government curriculum
 * materials — the de-identification check runs and finds nothing to scrub;
 * this stamp records that fact.
 */
const CURRICULUM_PROVENANCE = {
  deidentified: true as const,
  saltVersion: 0,
  dropped: [] as string[],
};

/**
 * Returns a StepExecutor for the `design-assessment-task` pipeline step (CE-06).
 * Reads ratified ASSESSMENT_POLICY rows from L0, retrieves the ratified GradeFramework
 * and TermPlan from the Brain artefact store, calls the gateway with the CE-06 prompt,
 * and returns a validated AssessmentTaskDesignResult.
 *
 * Throws `CurriculumSeedError` when:
 * - The input does not conform to `CE06Input`.
 * - The gateway response cannot be parsed as `AssessmentTaskDesignResult`.
 */
export function makeCE06Executor(
  withTenant: WithCE06TenantFn,
  listConstitution: ListConstitutionFn,
  getGradeFramework: GetGradeFrameworkFn,
  getTermPlan: GetTermPlanFn,
  gatewayCall: CE06GatewayCallFn,
  promptBody: string,
): (context: StepExecutionContext) => Promise<AssessmentTaskDesignResult> {
  return async (context: StepExecutionContext): Promise<AssessmentTaskDesignResult> => {
    const parsed = CE06Input.safeParse(context.input);
    if (!parsed.success) {
      throw new CurriculumSeedError(
        `CE-06 received invalid input: ${parsed.error.message}`,
      );
    }
    const { tenantId, grade, subject, termNumber, taskKind, academicYear } = parsed.data;

    return withTenant({ tenantId, actorId: 'ce06-executor' }, async (tx) => {
      const constitution = await listConstitution(tx);
      const assessmentPolicy = constitution.filter((r) => r.kind === 'ASSESSMENT_POLICY');

      const [gradeFramework, termPlan] = await Promise.all([
        getGradeFramework(tx, { grade, academicYear }),
        getTermPlan(tx, { grade, termNumber, academicYear }),
      ]);

      const request = ChatCompletionRequest.parse({
        tenantId,
        module: 'MOD-01',
        agent: 'CE-06',
        model: 'curriculum.assess',
        messages: [
          { role: 'system', content: promptBody },
          {
            role: 'user',
            content: JSON.stringify({
              input: { grade, subject, termNumber, taskKind, academicYear, tenantId },
              context: { assessmentPolicy, framework: gradeFramework, termPlan },
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
          `CE-06: gateway response was not valid JSON: ${response.message.content.slice(0, 120)}`,
        );
      }

      const result = AssessmentTaskDesignResult.safeParse(rawOutput);
      if (!result.success) {
        throw new CurriculumSeedError(
          `CE-06: gateway response did not conform to AssessmentTaskDesignResult: ${result.error.message}`,
        );
      }
      return result.data;
    });
  };
}
