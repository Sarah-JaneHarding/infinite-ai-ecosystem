// Decay and revalidation unit tests — Stage 13 step 10.
//
// "A CAPS version change invalidates dependent exemplars" (manual step 10).
// Covers TTL, CAPS invalidation, revalidation pass/fail, and valid paths.

import { describe, expect, it } from 'vitest';

import { assessPatternDecay } from '../src/index.js';

const BASE = {
  patternId: '11111111-1111-1111-1111-111111111111',
  lastValidatedAt: '2026-07-01T00:00:00.000Z',
  ttlDays: 90,
  currentCapsVersion: null,
  patternCapsVersion: null,
  today: '2026-08-01',
};

describe('assessPatternDecay', () => {
  it('returns valid with correct daysUntilExpiry when well within TTL', () => {
    const result = assessPatternDecay(BASE);
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      // 31 days elapsed, 90 - 31 = 59 remaining
      expect(result.daysUntilExpiry).toBe(59);
    }
  });

  it('returns revalidation_required when TTL is exceeded', () => {
    const result = assessPatternDecay({ ...BASE, today: '2026-10-01' });
    expect(result.status).toBe('revalidation_required');
    if (result.status === 'revalidation_required') {
      expect(result.reason).toBe('ttl_exceeded');
    }
  });

  it('returns valid on the exact expiry day (elapsed === ttlDays)', () => {
    // 90 days after 2026-07-01 is 2026-09-29
    const result = assessPatternDecay({ ...BASE, today: '2026-09-29' });
    // elapsed === ttlDays → still valid (> not >=)
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.daysUntilExpiry).toBe(0);
    }
  });

  it('invalidates immediately when CAPS version has changed', () => {
    const result = assessPatternDecay({
      ...BASE,
      currentCapsVersion: '2026.2',
      patternCapsVersion: '2026.1',
    });
    expect(result.status).toBe('invalidated');
    if (result.status === 'invalidated') {
      expect(result.reason).toBe('caps_version_change');
    }
  });

  it('does not invalidate when CAPS versions match', () => {
    const result = assessPatternDecay({
      ...BASE,
      currentCapsVersion: '2026.1',
      patternCapsVersion: '2026.1',
    });
    expect(result.status).toBe('valid');
  });

  it('does not invalidate when patternCapsVersion is null (version not recorded)', () => {
    const result = assessPatternDecay({
      ...BASE,
      currentCapsVersion: '2026.2',
      patternCapsVersion: null,
    });
    expect(result.status).toBe('valid');
  });

  it('invalidates when revalidation passRate falls below required', () => {
    const result = assessPatternDecay({
      ...BASE,
      revalidationResult: { passRate: 0.5, requiredPassRate: 0.75 },
    });
    expect(result.status).toBe('invalidated');
    if (result.status === 'invalidated') {
      expect(result.reason).toBe('revalidation_failed');
    }
  });

  it('returns valid and resets TTL when revalidation passes', () => {
    const result = assessPatternDecay({
      ...BASE,
      today: '2026-11-01',
      revalidationResult: { passRate: 0.9, requiredPassRate: 0.75 },
    });
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.daysUntilExpiry).toBe(90);
    }
  });

  it('prioritises CAPS change over revalidation result', () => {
    const result = assessPatternDecay({
      ...BASE,
      currentCapsVersion: '2026.2',
      patternCapsVersion: '2026.1',
      revalidationResult: { passRate: 0.9, requiredPassRate: 0.75 },
    });
    expect(result.status).toBe('invalidated');
    if (result.status === 'invalidated') {
      expect(result.reason).toBe('caps_version_change');
    }
  });
});
