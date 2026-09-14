// Prompt Evolver — Stage 13 step 4.
//
// Pure evolution logic extracted from LE-06's rules so they can be unit-tested
// deterministically.
//
// Manual rule (§13 step 4): "Build LE-05 and LE-06 producing candidates only."
// A PromptChallenger is never directly promoted to live — it requires human
// ratification via LE-07 and the ratification surface. `isLive` is always `false`.
//
// Recurring correction patterns (frequency >= EVOLVER_MIN_CORRECTION_FREQUENCY)
// are sorted by frequency descending and appended as a guidance block to the
// champion prompt's content. The challenger version is
// `${champion.version}+le06`.
//
// `challengerId` and `proposedAt` are injected via `PromptEvolverInput` for
// deterministic testing; callers supply `crypto.randomUUID` and `new Date().toISOString()`
// in production.

import type { CorrectionType, PromptChallenger } from '@infinite-ai/contracts';

/** Minimum frequency for a correction pattern to be included in a challenger prompt. */
export const EVOLVER_MIN_CORRECTION_FREQUENCY = 2 as const;

export interface CorrectionPattern {
  readonly correctionType: CorrectionType;
  readonly frequency: number;
  readonly representativeExample: string;
}

export interface PromptEvolverInput {
  readonly agentId: string;
  readonly championPrompt: {
    readonly version: string;
    readonly content: string;
  };
  readonly correctionPatterns: readonly CorrectionPattern[];
  /** ISO-8601 datetime stamped on the proposed challenger. */
  readonly now: string;
  /** Injected UUID generator — use `crypto.randomUUID` in production. */
  readonly idGenerator: () => string;
}

export type PromptEvolverDecision =
  | {
      readonly status: 'ok';
      readonly challenger: PromptChallenger;
    }
  | {
      readonly status: 'no_improvement_found';
      readonly detail: string;
    }
  | {
      readonly status: 'needs_input';
      readonly missingFields: readonly string[];
    };

/**
 * Builds a challenger prompt from recurring correction patterns.
 *
 * Returns `needs_input` when correctionPatterns is empty; `no_improvement_found`
 * when no pattern meets `EVOLVER_MIN_CORRECTION_FREQUENCY`; otherwise `ok` with
 * a challenger whose content appends a correction-guidance block to the champion.
 *
 * Every returned challenger has `isLive: false` — it is a proposal only. Human
 * ratification via LE-07 and the ratification surface is required before any
 * promotion to live.
 */
export function evolvePrompt(input: PromptEvolverInput): PromptEvolverDecision {
  if (input.correctionPatterns.length === 0) {
    return { status: 'needs_input', missingFields: ['correctionPatterns'] };
  }

  const recurring = input.correctionPatterns
    .filter((p) => p.frequency >= EVOLVER_MIN_CORRECTION_FREQUENCY)
    .sort((a, b) => b.frequency - a.frequency);

  if (recurring.length === 0) {
    return {
      status: 'no_improvement_found',
      detail: `No correction pattern met the minimum frequency of ${EVOLVER_MIN_CORRECTION_FREQUENCY}.`,
    };
  }

  const addressedTypes: CorrectionType[] = [...new Set(recurring.map((p) => p.correctionType))];

  const guidanceLines = recurring
    .map(
      (p) =>
        `- [${p.correctionType}] (×${p.frequency}): ${p.representativeExample}`,
    )
    .join('\n');

  const challengerContent =
    `${input.championPrompt.content}\n\n` +
    `[LE-06 enhancement]\n` +
    `The following correction patterns were observed frequently and should be avoided:\n` +
    guidanceLines;

  const rationale =
    `Challenger addresses ${recurring.length} recurring correction pattern(s): ` +
    addressedTypes.join(', ') +
    `. Frequencies: ` +
    recurring.map((p) => `${p.correctionType}×${p.frequency}`).join(', ') +
    `.`;

  const challenger: PromptChallenger = {
    challengerId: input.idGenerator(),
    agentId: input.agentId,
    challengerVersion: `${input.championPrompt.version}+le06`,
    content: challengerContent,
    addressedCorrectionTypes: addressedTypes,
    rationale,
    proposedAt: input.now,
    isLive: false,
  };

  return { status: 'ok', challenger };
}
