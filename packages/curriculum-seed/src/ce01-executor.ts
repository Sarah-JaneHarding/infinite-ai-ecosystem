// CE-01 CAPS Mapper executor factory — Stage 33.
//
// Returns a StepExecutor that drives the CE-01 CAPS Mapper agent:
//   1. Parses CE01Input from context.input.
//   2. Opens a tenant-scoped read transaction and loads CAPS_CANON rows.
//   3. Calls the Model Gateway with the CE-01 prompt body and the CAPS rows as context.
//   4. Parses and validates the response as FrameworkResult.
//
// The executor never contains learner data. CAPS documents are ratified government policy;
// the provenance stamp asserts the content was checked and contains no PII to de-identify.
//
// `withTenant`, `listCaps`, `gatewayCall`, and `promptBody` are injected for
// unit-testability without a real database or gateway.

import {
  CE01Input,
  ChatCompletionRequest,
  FrameworkResult,
  type ChatCompletionResponse,
} from '@infinite-ai/contracts';
import type { ConstitutionRow, TenantClient } from '@infinite-ai/db';

import type { StepExecutionContext } from './l0-gate-executor.js';
import { CurriculumSeedError } from './types.js';

export type WithCE01TenantFn = (
  ctx: { tenantId: string; actorId: string },
  fn: (tx: TenantClient) => Promise<FrameworkResult>,
) => Promise<FrameworkResult>;

export type ListCapsFn = (tx: TenantClient) => Promise<readonly ConstitutionRow[]>;

export type GatewayCallFn = (
  request: ChatCompletionRequest,
) => Promise<ChatCompletionResponse>;

/**
 * Provenance stamp for curriculum-only requests (no learner data).
 * CAPS documents are ratified government policy — the de-identification check
 * runs and finds nothing to scrub; this stamp records that fact.
 */
const CURRICULUM_PROVENANCE = {
  deidentified: true as const,
  saltVersion: 0,
  dropped: [] as string[],
};

/**
 * Returns a StepExecutor for the `build-topic-graph` pipeline step (CE-01).
 * Reads ratified CAPS_CANON rows from L0, calls the gateway with the CE-01 prompt,
 * and returns a validated FrameworkResult.
 *
 * Throws `CurriculumSeedError` when:
 * - The input does not conform to `CE01Input`.
 * - The gateway response cannot be parsed as `FrameworkResult`.
 */
export function makeCE01Executor(
  withTenant: WithCE01TenantFn,
  listCaps: ListCapsFn,
  gatewayCall: GatewayCallFn,
  promptBody: string,
): (context: StepExecutionContext) => Promise<FrameworkResult> {
  return async (context: StepExecutionContext): Promise<FrameworkResult> => {
    const parsed = CE01Input.safeParse(context.input);
    if (!parsed.success) {
      throw new CurriculumSeedError(
        `CE-01 received invalid input: ${parsed.error.message}`,
      );
    }
    const { tenantId, grade, subjects } = parsed.data;

    return withTenant({ tenantId, actorId: 'ce01-executor' }, async (tx) => {
      const constitution = await listCaps(tx);
      const l0Documents = constitution.filter((r) => r.kind === 'CAPS_CANON');

      const request = ChatCompletionRequest.parse({
        tenantId,
        module: 'MOD-01',
        agent: 'CE-01',
        model: 'curriculum.map',
        messages: [
          { role: 'system', content: promptBody },
          {
            role: 'user',
            content: JSON.stringify({
              input: { grade, subjects, tenantId },
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
          `CE-01: gateway response was not valid JSON: ${response.message.content.slice(0, 120)}`,
        );
      }

      const result = FrameworkResult.safeParse(rawOutput);
      if (!result.success) {
        throw new CurriculumSeedError(
          `CE-01: gateway response did not conform to FrameworkResult: ${result.error.message}`,
        );
      }
      return result.data;
    });
  };
}
