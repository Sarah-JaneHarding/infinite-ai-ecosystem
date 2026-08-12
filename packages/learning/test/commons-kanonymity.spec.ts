// Commons k-anonymity unit tests — Stage 13 step 10.
//
// "A below-threshold pattern cannot be published to the commons" (manual step 10).
// Covers suppression below threshold, no opt-in, and successful publication.

import { describe, expect, it } from 'vitest';

import { COMMONS_K_ANONYMITY_THRESHOLD } from '@infinite-ai/contracts';
import { decideCommonPublication } from '../src/index.js';

const THRESHOLD = COMMONS_K_ANONYMITY_THRESHOLD;

const ENOUGH_TENANTS = Array.from(
  { length: THRESHOLD },
  (_, i) => `00000000-0000-0000-0000-00000000000${i}`,
);
const TOO_FEW_TENANTS = ENOUGH_TENANTS.slice(0, THRESHOLD - 1);

describe('decideCommonPublication', () => {
  it('allows publication when opt-in is true and tenant count meets threshold', () => {
    const result = decideCommonPublication(true, ENOUGH_TENANTS);
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.contributingTenantCount).toBe(THRESHOLD);
    }
  });

  it('allows publication when tenant count exceeds threshold', () => {
    const moreTenants = [...ENOUGH_TENANTS, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'];
    const result = decideCommonPublication(true, moreTenants);
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.contributingTenantCount).toBe(THRESHOLD + 1);
    }
  });

  it('blocks publication when tenant count is one below threshold', () => {
    const result = decideCommonPublication(true, TOO_FEW_TENANTS);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toBe('below_threshold');
      expect(result.contributingTenantCount).toBe(THRESHOLD - 1);
    }
  });

  it('blocks publication when tenant count is zero', () => {
    const result = decideCommonPublication(true, []);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toBe('below_threshold');
      expect(result.contributingTenantCount).toBe(0);
    }
  });

  it('blocks publication when tenant opt-in is false regardless of tenant count', () => {
    const result = decideCommonPublication(false, ENOUGH_TENANTS);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toBe('no_opt_in');
    }
  });

  it('blocks for no_opt_in even when tenant count far exceeds threshold', () => {
    const manyTenants = Array.from({ length: 100 }, (_, i) => `tenant-${i}`);
    const result = decideCommonPublication(false, manyTenants);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toBe('no_opt_in');
    }
  });

  it('COMMONS_K_ANONYMITY_THRESHOLD is exactly 5', () => {
    expect(THRESHOLD).toBe(5);
  });
});
