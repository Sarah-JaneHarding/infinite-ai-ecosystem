// The input side of the guardrail engine — Stage 06 step 6.
//
// "input: schema validation, purpose check, consent check, PII guard, prompt-injection
// detection on any retrieved or user-supplied text, token budget." Five checks; this
// module is four of them plus the composition point `engine.ts` calls in order. The PII
// guard and the purpose/consent check are not rebuilt here — they already exist
// (`pii-guard.ts`, Stage 03 step 5; `packages/policy`'s `resolveAccess`, Stage 03 step 3) —
// this module only wraps each one's own verdict into the one `GuardrailVerdict` shape
// every check in this package returns.
//
// `packages/guardrails` takes no dependency on `packages/agents`: the layer diagram has L6
// (agent runtime) sit above L5 (this package), so a token budget is accepted here as the
// one field this check actually reads (`{ maxTokens }`), not as `AgentContract['budget']`
// by name — any object with that shape satisfies it, `AgentBudget` included, without this
// package needing to know the wider contract exists.

import type { DataCategory } from '@infinite-ai/contracts';
import { resolveAccess, type AccessRequest } from '@infinite-ai/policy';
import type { z } from 'zod';

import { checkPromptInjection } from './prompt-injection.js';
import { inspectEgress, type EgressPayload } from './pii-guard.js';
import { PASSED, refuse, type GuardrailVerdict } from './refusal.js';
import type { TenantLexicon } from '@infinite-ai/deident';

/** Validates `input` against the agent's own declared `inputSchema` — the first gate, so a
 * structurally invalid call never reaches a check that assumes a valid shape. */
export function checkInputSchema(schema: z.ZodType, input: unknown): GuardrailVerdict {
  const result = schema.safeParse(input);
  if (result.success) return PASSED;
  return refuse(
    'invalid_input_schema',
    `Input failed schema validation: ${result.error.message}`,
  );
}

/**
 * Every `DataCategory` this call actually needs must come back `allowed` from
 * `resolveAccess` — not merely "requested". `resolveAccess` itself never throws (a
 * projection, not an exception, per its own header); this check is what turns "some of
 * what was asked for got dropped" into a refusal for the categories this particular call
 * cannot proceed without. The first dropped, required category's own reason becomes the
 * refusal's reason code — `DropReason`'s four values are exactly four of
 * `RefusalReasonCode`'s (see `refusal.ts`'s own compile-time check).
 */
export function checkPurposeAndConsent(
  request: AccessRequest,
  requiredCategories: readonly DataCategory[],
): GuardrailVerdict {
  const decision = resolveAccess(request);
  const allowed = new Set(decision.allowed);
  for (const category of requiredCategories) {
    if (!allowed.has(category)) {
      const drop = decision.dropped.find((d) => d.category === category);
      const reason = drop?.reason ?? 'purpose_not_permitted';
      return refuse(
        reason,
        `Category "${category}" is required for this call and was not permitted: ${reason}.`,
      );
    }
  }
  return PASSED;
}

/** Wraps `inspectEgress` — the PII guard already checks provenance first and on its own
 * sufficient to refuse, then raw identifiers, then the tenant lexicon. */
export function checkPii(
  payload: EgressPayload,
  lexicon: TenantLexicon,
): GuardrailVerdict {
  const verdict = inspectEgress(payload, lexicon);
  if (verdict.allowed) return PASSED;
  return refuse(verdict.reason, verdict.detail);
}

export { checkPromptInjection };

/** `roughly four characters per token` — the exact heuristic
 * `packages/brain/src/retrieval-assembly.ts`'s own `estimateTokens` already uses, for the
 * same reason: a real tokenizer is a dependency this stage does not yet justify adding, and
 * a conservative overestimate still guarantees the budget is never silently exceeded. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface TokenBudget {
  readonly maxTokens: number;
}

export function checkTokenBudget(
  texts: readonly string[],
  budget: TokenBudget,
): GuardrailVerdict {
  const total = texts.reduce((sum, text) => sum + estimateTokens(text), 0);
  if (total > budget.maxTokens) {
    return refuse(
      'token_budget_exceeded',
      `Estimated ${total} tokens exceeds this agent's own budget of ${budget.maxTokens}.`,
    );
  }
  return PASSED;
}
