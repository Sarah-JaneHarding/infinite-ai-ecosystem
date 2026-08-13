// Token budget enforcement — Stage 20 (Master Prompt Builder).
//
// The gateway enforces hard per-model token limits; this module provides an
// early, cheap estimate so the builder can reject an over-budget prompt before
// the gateway round-trip. The estimate is intentionally conservative (4 chars
// per token — true for English prose, pessimistic for structured JSON).
//
// A budget has three fields that mirror the orchestrator's cost config:
//   maxSystemTokens   — characters dedicated to the system sections
//   maxUserTokens     — characters dedicated to the user-turn sections
//   maxOutputTokens   — reserved for the model's response (not checked here,
//                       but carried through so callers can forward it to the
//                       gateway's `max_tokens` parameter)

import { z } from 'zod';

/** Rough token count: 1 token ≈ 4 characters for English/structured text. */
export const CHARS_PER_TOKEN = 4;

export const PromptBudget = z.object({
  maxSystemTokens: z.number().int().positive(),
  maxUserTokens: z.number().int().positive(),
  maxOutputTokens: z.number().int().positive(),
});
export type PromptBudget = z.infer<typeof PromptBudget>;

export const DEFAULT_BUDGET: PromptBudget = {
  maxSystemTokens: 4_000,
  maxUserTokens: 8_000,
  maxOutputTokens: 4_000,
};

export class PromptBudgetError extends Error {
  public override readonly name = 'PromptBudgetError';
  constructor(
    message: string,
    public readonly section: 'system' | 'user',
    public readonly estimatedTokens: number,
    public readonly maxTokens: number,
  ) {
    super(message);
  }
}

/** Returns a conservative token-count estimate for a string. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Throws `PromptBudgetError` if either side of the split exceeds its budget.
 * Returns void if the prompt fits.
 */
export function enforceBudget(
  systemText: string,
  userText: string,
  budget: PromptBudget = DEFAULT_BUDGET,
): void {
  const systemTokens = estimateTokens(systemText);
  if (systemTokens > budget.maxSystemTokens) {
    throw new PromptBudgetError(
      `System prompt exceeds budget: ~${systemTokens} tokens estimated, ` +
        `max ${budget.maxSystemTokens}.`,
      'system',
      systemTokens,
      budget.maxSystemTokens,
    );
  }
  const userTokens = estimateTokens(userText);
  if (userTokens > budget.maxUserTokens) {
    throw new PromptBudgetError(
      `User turn exceeds budget: ~${userTokens} tokens estimated, ` +
        `max ${budget.maxUserTokens}.`,
      'user',
      userTokens,
      budget.maxUserTokens,
    );
  }
}
