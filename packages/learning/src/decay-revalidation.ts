// Decay & Revalidation outer function — Stage 13 step 8.
//
// Outer LE-09 function wrapping the lower-level assessPatternDecay with full
// LE09-shaped input/output: adds tenantId, processedAt, patternId to every variant,
// and invalidatedAt (= now) to the invalidated variant.

import type { DecayReason, MinedPattern } from '@infinite-ai/contracts';

import { assessPatternDecay } from './decay-agent.js';

export interface DecayCheckInput {
  readonly tenantId: string;
  /** Absent triggers needs_input. */
  readonly pattern?: MinedPattern;
  readonly lastValidatedAt: string;
  readonly ttlDays: number;
  readonly currentCapsVersion: string | null;
  readonly patternCapsVersion: string | null;
  readonly revalidationResult?: {
    readonly passRate: number;
    readonly requiredPassRate: number;
  };
  /** Today's date (YYYY-MM-DD) — injected so the function is deterministic. */
  readonly today: string;
  /** ISO-8601 datetime injected for processedAt and invalidatedAt. */
  readonly now: string;
}

export type DecayCheckDecision =
  | {
      readonly status: 'valid';
      readonly tenantId: string;
      readonly processedAt: string;
      readonly patternId: string;
      readonly daysUntilExpiry: number;
    }
  | {
      readonly status: 'invalidated';
      readonly tenantId: string;
      readonly processedAt: string;
      readonly patternId: string;
      readonly reason: DecayReason;
      readonly detail: string;
      readonly invalidatedAt: string;
    }
  | {
      readonly status: 'revalidation_required';
      readonly tenantId: string;
      readonly processedAt: string;
      readonly patternId: string;
      readonly reason: DecayReason;
      readonly detail: string;
    }
  | {
      readonly status: 'needs_input';
      readonly tenantId: string;
      readonly processedAt: string;
      readonly detail: string;
      readonly missingFields: readonly string[];
    };

/**
 * Outer LE-09 decay and revalidation check.
 *
 * Returns needs_input when required fields are absent. Delegates to
 * assessPatternDecay and augments the result with tenantId, processedAt,
 * patternId, and (for invalidated) invalidatedAt = now.
 */
export function runDecayCheck(input: DecayCheckInput): DecayCheckDecision {
  const missingFields: string[] = [];
  if (!input.pattern) missingFields.push('pattern');
  if (!input.lastValidatedAt) missingFields.push('lastValidatedAt');
  if (!input.today) missingFields.push('today');

  if (missingFields.length > 0) {
    return {
      status: 'needs_input',
      tenantId: input.tenantId,
      processedAt: input.now,
      detail: `Missing required fields: ${missingFields.join(', ')}.`,
      missingFields,
    };
  }

  const pattern = input.pattern as MinedPattern;

  const decision = assessPatternDecay({
    patternId: pattern.patternId,
    lastValidatedAt: input.lastValidatedAt,
    ttlDays: input.ttlDays,
    currentCapsVersion: input.currentCapsVersion,
    patternCapsVersion: input.patternCapsVersion,
    ...(input.revalidationResult !== undefined
      ? { revalidationResult: input.revalidationResult }
      : {}),
    today: input.today,
  });

  if (decision.status === 'valid') {
    return {
      status: 'valid',
      tenantId: input.tenantId,
      processedAt: input.now,
      patternId: pattern.patternId,
      daysUntilExpiry: decision.daysUntilExpiry,
    };
  }

  if (decision.status === 'invalidated') {
    return {
      status: 'invalidated',
      tenantId: input.tenantId,
      processedAt: input.now,
      patternId: pattern.patternId,
      reason: decision.reason,
      detail: decision.detail,
      invalidatedAt: input.now,
    };
  }

  return {
    status: 'revalidation_required',
    tenantId: input.tenantId,
    processedAt: input.now,
    patternId: pattern.patternId,
    reason: decision.reason,
    detail: decision.detail,
  };
}
