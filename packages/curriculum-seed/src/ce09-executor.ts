// CE-09 Coverage Auditor executor factory — Stage 41.
//
// Returns a StepExecutor that drives the CE-09 Coverage Auditor:
//   1. Parses CE09Input from context.input.
//   2. Opens a tenant-scoped read transaction.
//   3. Concurrently retrieves the ratified TermPlan (CE-03) and the L2 EpisodeLog
//      from the Brain artefact store.
//   4. Calls the Model Gateway with the CE-09 prompt, the TermPlan, and the EpisodeLog.
//   5. Parses and validates the response as CoverageAuditResult.
//
// CE-09 does not need any constitution rows — it works entirely from two Brain artefacts:
//   - context.termPlan   — TermPlan from CE-03 (the planned curriculum for the term)
//   - context.episodeLog — EpisodeLog from L2 (actual lessons delivered this term)
//
// The executor never contains learner data. The TermPlan and EpisodeLog are
// curriculum planning and delivery records; the provenance stamp records that no
// PII scrubbing is needed.
//
// `withTenant`, `getTermPlan`, `getEpisodeLog`, `gatewayCall`, and `promptBody`
// are injected for unit-testability without a real database or gateway.

import {
  CE09Input,
  ChatCompletionRequest,
  CoverageAuditResult,
  type ChatCompletionResponse,
  type EpisodeLog,
} from '@infinite-ai/contracts';
import type { TenantClient } from '@infinite-ai/db';

import type { GetTermPlanFn } from './ce04-executor.js';
import type { StepExecutionContext } from './l0-gate-executor.js';
import { CurriculumSeedError } from './types.js';

export type WithCE09TenantFn = (
  ctx: { tenantId: string; actorId: string },
  fn: (tx: TenantClient) => Promise<CoverageAuditResult>,
) => Promise<CoverageAuditResult>;

/**
 * Retrieves the L2 episode log (actual lessons delivered) for a given grade, subject,
 * term, and academic year from the Brain artefact store.
 * Returns null when no episode log exists yet for the term.
 */
export type GetEpisodeLogFn = (
  tx: TenantClient,
  params: {
    grade: string;
    subject: string;
    termNumber: number;
    academicYear: number;
  },
) => Promise<EpisodeLog | null>;

export type CE09GatewayCallFn = (
  request: ChatCompletionRequest,
) => Promise<ChatCompletionResponse>;

// Re-export so callers can wire the same getter without touching ce04-executor directly.
export type { GetTermPlanFn };

/**
 * Provenance stamp for curriculum-only requests (no learner data).
 * TermPlan and EpisodeLog are school curriculum planning and delivery records — the
 * de-identification check runs and finds nothing to scrub; this stamp records that fact.
 */
const CURRICULUM_PROVENANCE = {
  deidentified: true as const,
  saltVersion: 0,
  dropped: [] as string[],
};

/**
 * Returns a StepExecutor for the `audit-coverage` pipeline step (CE-09).
 * Retrieves the ratified TermPlan and L2 EpisodeLog from the Brain artefact store,
 * calls the gateway with the CE-09 prompt, and returns a validated CoverageAuditResult.
 *
 * Throws `CurriculumSeedError` when:
 * - The input does not conform to `CE09Input`.
 * - The gateway response cannot be parsed as `CoverageAuditResult`.
 */
export function makeCE09Executor(
  withTenant: WithCE09TenantFn,
  getTermPlan: GetTermPlanFn,
  getEpisodeLog: GetEpisodeLogFn,
  gatewayCall: CE09GatewayCallFn,
  promptBody: string,
): (context: StepExecutionContext) => Promise<CoverageAuditResult> {
  return async (context: StepExecutionContext): Promise<CoverageAuditResult> => {
    const parsed = CE09Input.safeParse(context.input);
    if (!parsed.success) {
      throw new CurriculumSeedError(
        `CE-09 received invalid input: ${parsed.error.message}`,
      );
    }
    const { tenantId, grade, subject, termNumber, academicYear } = parsed.data;

    return withTenant({ tenantId, actorId: 'ce09-executor' }, async (tx) => {
      const [termPlan, episodeLog] = await Promise.all([
        getTermPlan(tx, { grade, termNumber, academicYear }),
        getEpisodeLog(tx, { grade, subject, termNumber, academicYear }),
      ]);

      const request = ChatCompletionRequest.parse({
        tenantId,
        module: 'MOD-01',
        agent: 'CE-09',
        model: 'curriculum.audit',
        messages: [
          { role: 'system', content: promptBody },
          {
            role: 'user',
            content: JSON.stringify({
              input: {
                grade,
                subject,
                termNumber,
                academicYear,
                tenantId,
              },
              context: { termPlan, episodeLog },
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
          `CE-09: gateway response was not valid JSON: ${response.message.content.slice(0, 120)}`,
        );
      }

      const result = CoverageAuditResult.safeParse(rawOutput);
      if (!result.success) {
        throw new CurriculumSeedError(
          `CE-09: gateway response did not conform to CoverageAuditResult: ${result.error.message}`,
        );
      }
      return result.data;
    });
  };
}
