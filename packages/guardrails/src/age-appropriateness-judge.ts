// A real `AgeAppropriatenessJudge` — the Model Gateway call `brain-age-appropriateness.ts`
// documents as its own missing half (OQ-015 Gap 2's "model call" part). What this file does
// NOT do: decide, invent, or extend any rule about what is developmentally appropriate —
// that stays entirely inside the AGE-APPROPRIATENESS-JUDGE prompt, which is instructed to
// judge only against the ratified clauses it is handed for each call (see that prompt's own
// HARD CONSTRAINTS section). This file's job is the mechanical half: build the gateway
// request, call it, and turn the response into the typed verdict shape
// `AgeAppropriatenessJudge` already declares — the same "prompt does the judging, code does
// the plumbing" split every agent executor in `packages/curriculum-seed` already uses
// (see `ce01-executor.ts`).
//
// Fails closed by construction: a network error, a non-2xx response, a non-JSON reply, or a
// reply that does not match the expected `{ appropriate, rationale }` shape all resolve to
// `appropriate: false` rather than throwing. A judge that cannot render a real verdict is
// exactly the "unjudged content" case rule 0's safety posture treats as a refusal, not a
// pass — the opposite of the fail-open default `checkAgeAppropriateness` already uses when
// no judge is supplied at all (see output-checks.ts's own header for why that default is
// honest rather than a silent guarantee).
//
// Scope, same as `createBrainAgeAppropriatenessChecker`'s own documented scope: this is
// built for pipelines whose output carries no learner PII (MOD-01/MOD-04 curriculum
// planning, matching `brain-age-appropriateness.ts`'s own `resource.type: 'lesson_plan'`
// system actor). `provenance` is a required constructor parameter, not defaulted, precisely
// so a caller wiring this into a pipeline whose output *could* carry learner-derived text
// has to consciously supply a truthful de-identification stamp rather than inherit one that
// was only ever honest for curriculum content (rule 4: no escape hatch). The gateway itself
// independently re-checks every payload against the tenant's own PII lexicon regardless of
// what a caller stamps (`packages/guardrails/src/pii-guard.ts`, wired at `apps/gateway/src/
// server.ts`) — this constructor parameter is about not making a false claim, not the only
// line of defence.

import {
  ChatCompletionRequest,
  type ChatCompletionResponse,
} from '@infinite-ai/contracts';
import { z } from 'zod';

import type { DeidentificationProvenance } from './pii-guard.js';
import type { AgeAppropriatenessJudge } from './brain-age-appropriateness.js';

/** Matches `GatewayCallFn` in `packages/curriculum-seed`'s executors — the same injected
 * "POST to the Model Gateway" shape, so a caller that already has one (e.g. `apps/worker`'s
 * `fetch`-based implementation) can pass it straight through. */
export type JudgeGatewayCallFn = (
  request: ChatCompletionRequest,
) => Promise<ChatCompletionResponse>;

const AgeAppropriatenessVerdict = z.object({
  appropriate: z.boolean(),
  rationale: z.string().min(1),
});

/** Returns a fail-closed verdict with `reason` folded into the rationale, so every failure
 * mode below produces the same honest, traceable shape rather than a bare boolean. */
function failClosed(reason: string): { appropriate: false; rationale: string } {
  return {
    appropriate: false,
    rationale:
      `Age-appropriateness judge could not render a verdict, failing closed rather than ` +
      `passing unjudged content: ${reason}`,
  };
}

/**
 * Builds a real `AgeAppropriatenessJudge` that calls the Model Gateway with the
 * AGE-APPROPRIATENESS-JUDGE prompt, grounded in exactly the clauses it is given for each
 * call. `promptBody` is the prompt's own body text (loaded via `@infinite-ai/prompts`'
 * `loadPromptFile`, the same way every other agent's prompt is loaded) — this package does
 * not read the filesystem itself, matching every other injected-dependency shape here.
 */
export function createGatewayAgeAppropriatenessJudge(
  gatewayCall: JudgeGatewayCallFn,
  tenantId: string,
  promptBody: string,
  provenance: DeidentificationProvenance,
): AgeAppropriatenessJudge {
  return async (clauses, output) => {
    let response: ChatCompletionResponse;
    try {
      const request = ChatCompletionRequest.parse({
        tenantId,
        module: 'guardrails',
        agent: 'AGE-APPROPRIATENESS-JUDGE',
        model: 'guardrail.age_appropriateness',
        messages: [
          { role: 'system', content: promptBody },
          { role: 'user', content: JSON.stringify({ clauses, output }) },
        ],
        temperature: 0,
        provenance,
      });
      response = await gatewayCall(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return failClosed(`gateway call failed: ${message}`);
    }

    let rawVerdict: unknown;
    try {
      rawVerdict = JSON.parse(response.message.content) as unknown;
    } catch {
      return failClosed(
        `gateway response was not valid JSON: ${response.message.content.slice(0, 200)}`,
      );
    }

    const parsed = AgeAppropriatenessVerdict.safeParse(rawVerdict);
    if (!parsed.success) {
      return failClosed(
        `gateway response did not match the expected verdict shape: ${parsed.error.message}`,
      );
    }
    return parsed.data;
  };
}
