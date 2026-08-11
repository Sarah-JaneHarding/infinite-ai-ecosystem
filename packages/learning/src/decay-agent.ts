// Decay & Revalidation logic — Stage 13 step 8.
//
// Pure rules extracted from LE-09's prompt so they can be unit-tested deterministically.
// Priority: CAPS version change > revalidation result > TTL > valid.

import type { DecayReason } from '@infinite-ai/contracts';

export type DecayDecision =
  | { readonly status: 'valid'; readonly daysUntilExpiry: number }
  | {
      readonly status: 'invalidated';
      readonly reason: DecayReason;
      readonly detail: string;
    }
  | {
      readonly status: 'revalidation_required';
      readonly reason: DecayReason;
      readonly detail: string;
    };

export interface DecayInput {
  readonly patternId: string;
  readonly lastValidatedAt: string;
  readonly ttlDays: number;
  readonly currentCapsVersion: string | null;
  readonly patternCapsVersion: string | null;
  readonly revalidationResult?: {
    readonly passRate: number;
    readonly requiredPassRate: number;
  };
  readonly today: string;
}

function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

/**
 * Applies LE-09's decay and revalidation rules deterministically.
 * Inject `today` as YYYY-MM-DD so the function is pure and testable.
 */
export function assessPatternDecay(input: DecayInput): DecayDecision {
  const {
    currentCapsVersion,
    patternCapsVersion,
    revalidationResult,
    ttlDays,
    lastValidatedAt,
    today,
  } = input;

  if (
    currentCapsVersion !== null &&
    patternCapsVersion !== null &&
    currentCapsVersion !== patternCapsVersion
  ) {
    return {
      status: 'invalidated',
      reason: 'caps_version_change',
      detail: `CAPS version changed from ${patternCapsVersion} to ${currentCapsVersion}. Pattern mined against the old version is no longer valid.`,
    };
  }

  if (revalidationResult !== undefined) {
    if (revalidationResult.passRate < revalidationResult.requiredPassRate) {
      return {
        status: 'invalidated',
        reason: 'revalidation_failed',
        detail: `Revalidation pass rate ${revalidationResult.passRate.toFixed(2)} is below required ${revalidationResult.requiredPassRate.toFixed(2)}.`,
      };
    }
    return { status: 'valid', daysUntilExpiry: ttlDays };
  }

  const elapsed = daysBetween(lastValidatedAt, today);
  if (elapsed > ttlDays) {
    return {
      status: 'revalidation_required',
      reason: 'ttl_exceeded',
      detail: `Pattern has not been revalidated in ${elapsed} days (TTL: ${ttlDays} days).`,
    };
  }

  return { status: 'valid', daysUntilExpiry: Math.max(0, ttlDays - elapsed) };
}
