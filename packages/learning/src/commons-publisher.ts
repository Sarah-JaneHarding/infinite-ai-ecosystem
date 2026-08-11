// Commons publisher — Stage 13 step 7.
//
// Pure k-anonymity enforcement extracted from LE-08's rules.
// A pattern below the threshold cannot be published. This function is called by the
// commons publisher agent and directly in the k-anonymity unit tests.

import { COMMONS_K_ANONYMITY_THRESHOLD } from '@infinite-ai/contracts';

export type PublishDecision =
  | { readonly allowed: true; readonly contributingTenantCount: number }
  | {
      readonly allowed: false;
      readonly reason: 'no_opt_in' | 'below_threshold';
      readonly contributingTenantCount: number;
    };

/**
 * Decides whether a pattern may be published to the cross-school commons.
 *
 * Rules (all must pass):
 * 1. `tenantOptIn` must be true — tenant's explicit choice.
 * 2. `contributingTenantCount` must be >= COMMONS_K_ANONYMITY_THRESHOLD (5).
 */
export function decideCommonPublication(
  tenantOptIn: boolean,
  contributingTenantRefs: readonly string[],
): PublishDecision {
  if (!tenantOptIn) {
    return {
      allowed: false,
      reason: 'no_opt_in',
      contributingTenantCount: contributingTenantRefs.length,
    };
  }
  const count = contributingTenantRefs.length;
  if (count < COMMONS_K_ANONYMITY_THRESHOLD) {
    return { allowed: false, reason: 'below_threshold', contributingTenantCount: count };
  }
  return { allowed: true, contributingTenantCount: count };
}
