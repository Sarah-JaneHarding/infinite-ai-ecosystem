// CE-07 Rubric Builder executor factory — Stage 39.
//
// Returns a StepExecutor that drives the CE-07 Rubric Builder agent:
//   1. Parses CE07Input from context.input.
//   2. Opens a tenant-scoped read transaction.
//   3. Concurrently retrieves the ratified GradeFramework (CE-01) and the ratified
//      AssessmentTaskDesign (CE-06) from the Brain artefact store.
//   4. Calls the Model Gateway with the CE-07 prompt, the GradeFramework, and the
//      AssessmentTaskDesign.
//   5. Parses and validates the response as RubricResult.
//
// CE-07 does not need any constitution rows — it works entirely from two Brain artefacts:
//   - context.framework     — GradeFramework from CE-01 (every criterion must trace here)
//   - context.assessmentTask — AssessmentTaskDesign from CE-06 (the task being rubric-ised)
//
// The executor never contains learner data. The GradeFramework and AssessmentTaskDesign are
// curriculum/school materials; the provenance stamp records that no PII scrubbing is needed.
//
// `withTenant`, `getGradeFramework`, `getAssessmentTask`, `gatewayCall`, and `promptBody`
// are injected for unit-testability without a real database or gateway.

import {
  CE07Input,
  ChatCompletionRequest,
  type AssessmentTaskDesign,
  type ChatCompletionResponse,
  type GradeFramework,
  RubricResult,
} from '@infinite-ai/contracts';
import type { TenantClient } from '@infinite-ai/db';

import type { StepExecutionContext } from './l0-gate-executor.js';
import { CurriculumSeedError } from './types.js';

export type WithCE07TenantFn = (
  ctx: { tenantId: string; actorId: string },
  fn: (tx: TenantClient) => Promise<RubricResult>,
) => Promise<RubricResult>;

/**
 * Retrieves the ratified GradeFramework for a given grade.
 * CE-07 input does not carry academicYear, so the implementation resolves the current
 * academic year internally.
 * Returns null when no ratified framework exists yet.
 */
export type GetRubricFrameworkFn = (
  tx: TenantClient,
  params: { grade: string },
) => Promise<GradeFramework | null>;

/**
 * Retrieves the ratified AssessmentTaskDesign for a given grade, subject, task kind,
 * and total marks from the Brain artefact store.
 * Returns null when no ratified task design exists yet (CE-06 has not been run and approved).
 */
export type GetAssessmentTaskFn = (
  tx: TenantClient,
  params: {
    grade: string;
    subject: string;
    taskKind: string;
    totalMarks: number;
  },
) => Promise<AssessmentTaskDesign | null>;

export type CE07GatewayCallFn = (
  request: ChatCompletionRequest,
) => Promise<ChatCompletionResponse>;

/**
 * Provenance stamp for curriculum-only requests (no learner data).
 * GradeFramework and AssessmentTaskDesign are school curriculum materials — the
 * de-identification check runs and finds nothing to scrub; this stamp records that fact.
 */
const CURRICULUM_PROVENANCE = {
  deidentified: true as const,
  saltVersion: 0,
  dropped: [] as string[],
};

/**
 * Returns a StepExecutor for the `build-rubric` pipeline step (CE-07).
 * Retrieves the ratified GradeFramework and AssessmentTaskDesign from the Brain artefact
 * store, calls the gateway with the CE-07 prompt, and returns a validated RubricResult.
 *
 * Throws `CurriculumSeedError` when:
 * - The input does not conform to `CE07Input`.
 * - The gateway response cannot be parsed as `RubricResult`.
 */
export function makeCE07Executor(
  withTenant: WithCE07TenantFn,
  getGradeFramework: GetRubricFrameworkFn,
  getAssessmentTask: GetAssessmentTaskFn,
  gatewayCall: CE07GatewayCallFn,
  promptBody: string,
): (context: StepExecutionContext) => Promise<RubricResult> {
  return async (context: StepExecutionContext): Promise<RubricResult> => {
    const parsed = CE07Input.safeParse(context.input);
    if (!parsed.success) {
      throw new CurriculumSeedError(
        `CE-07 received invalid input: ${parsed.error.message}`,
      );
    }
    const { tenantId, grade, subject, taskKind, totalMarks } = parsed.data;

    return withTenant({ tenantId, actorId: 'ce07-executor' }, async (tx) => {
      const [gradeFramework, assessmentTask] = await Promise.all([
        getGradeFramework(tx, { grade }),
        getAssessmentTask(tx, { grade, subject, taskKind, totalMarks }),
      ]);

      const request = ChatCompletionRequest.parse({
        tenantId,
        module: 'MOD-01',
        agent: 'CE-07',
        model: 'curriculum.rubric',
        messages: [
          { role: 'system', content: promptBody },
          {
            role: 'user',
            content: JSON.stringify({
              input: { grade, subject, taskKind, tenantId, totalMarks },
              context: { framework: gradeFramework, assessmentTask },
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
          `CE-07: gateway response was not valid JSON: ${response.message.content.slice(0, 120)}`,
        );
      }

      const result = RubricResult.safeParse(rawOutput);
      if (!result.success) {
        throw new CurriculumSeedError(
          `CE-07: gateway response did not conform to RubricResult: ${result.error.message}`,
        );
      }
      return result.data;
    });
  };
}
