// The age-appropriateness checker the worker wires into MOD-01/MOD-04 jobs (OQ-015), built
// once from the gateway URL. Lives here, not in `index.ts`, so the dev in-process runner
// applies exactly the same guardrail as the BullMQ worker.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ChatCompletionRequest, ChatCompletionResponse } from '@infinite-ai/contracts';
import type { CapsPhase } from '@infinite-ai/contracts';
import type { TenantClient } from '@infinite-ai/db';
import {
  createBrainAgeAppropriatenessChecker,
  createGatewayAgeAppropriatenessJudge,
  type AgeAppropriatenessChecker,
  type DeidentificationProvenance,
  type JudgeGatewayCallFn,
} from '@infinite-ai/guardrails';
import { loadPromptFile } from '@infinite-ai/prompts';

/** The absolute path to the prompts source tree — works from both src/ and built output. */
export function resolvePromptsRoot(): string {
  const thisFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(thisFile), '../../../packages/prompts/src');
}

/**
 * `JudgeGatewayCallFn` implementation for `createGatewayAgeAppropriatenessJudge` — the same
 * "POST to /v1/chat/completions, throw on a non-2xx response" shape `step-executor.ts`'s own
 * `runAgentCall` already uses for every other gateway call this app makes. Throwing here
 * (rather than swallowing) is deliberate: the judge's own fail-closed try/catch is what turns
 * this into `appropriate: false` — this function's job is just to report the failure
 * honestly, not to decide what it means.
 */
function createWorkerGatewayCall(gatewayBaseUrl: string): JudgeGatewayCallFn {
  return async (request) => {
    const response = await fetch(`${gatewayBaseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ChatCompletionRequest.parse(request)),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Gateway returned HTTP ${response.status} for the age-appropriateness judge: ` +
          text.slice(0, 300),
      );
    }
    const rawJson: unknown = await response.json();
    return ChatCompletionResponse.parse(rawJson);
  };
}

/**
 * The provenance stamp for the judge's own gateway call. Honest only for the scope
 * `createBrainAgeAppropriatenessChecker` already documents itself as built for — MOD-01/
 * MOD-04 curriculum-planning pipelines, which carry no learner-derived text (the same
 * `CURRICULUM_PROVENANCE` reasoning `packages/curriculum-seed`'s CE executors already use).
 * A pipeline whose output could carry learner-derived text needs a real de-identification
 * step before this stamp would be true for it — see `age-appropriateness-judge.ts`'s own
 * header for why this is a required constructor parameter rather than a silent default.
 */
const CURRICULUM_PLANNING_PROVENANCE: DeidentificationProvenance = {
  deidentified: true,
  saltVersion: 0,
  dropped: [],
};

/** OQ-015 Gap 1 + 2: a phase-scoped checker, grounded in the ratified Brain clauses for the
 * job's phase, that renders a real verdict via the Model Gateway and fails closed. The judge
 * prompt is loaded once, not per call. */
export function buildAgeCheckerFactory(
  gatewayBaseUrl: string,
): (tx: TenantClient, tenantId: string, phase: CapsPhase) => AgeAppropriatenessChecker {
  const { body: promptBody } = loadPromptFile(
    path.join(resolvePromptsRoot(), 'AGE-APPROPRIATENESS-JUDGE', '1.0.0.prompt.md'),
  );
  const gatewayCall = createWorkerGatewayCall(gatewayBaseUrl);
  return (tx, tenantId, phase) =>
    createBrainAgeAppropriatenessChecker(
      tx,
      tenantId,
      phase,
      createGatewayAgeAppropriatenessJudge(
        gatewayCall,
        tenantId,
        promptBody,
        CURRICULUM_PLANNING_PROVENANCE,
      ),
    );
}
