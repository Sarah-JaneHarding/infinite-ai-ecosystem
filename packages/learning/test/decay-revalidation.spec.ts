// Decay Revalidation unit tests — Stage 13 step 8.
//
// "Build LE-09 with outer decay check wrapping assessPatternDecay"
// (manual step 8). Covers runDecayCheck.

import { describe, expect, it } from 'vitest';

import { type DecayCheckInput, runDecayCheck } from '../src/index.js';

const PATTERN = {
  patternId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  capsTopicId: 'MATH-GR4-NUM',
  agentId: 'agent-le09',
  sampleSize: 12,
  effectSize: 0.18,
  confidenceInterval: [0.05, 0.31] as [number, number],
  biasChecked: true,
  minedAt: '2026-09-01T08:00:00.000Z',
};

// lastValidatedAt = 2026-08-01, today = 2026-09-15 → 45 elapsed days, TTL 90 → valid
const BASE: DecayCheckInput = {
  tenantId: '00000000-0000-0000-0000-000000000001',
  pattern: PATTERN,
  lastValidatedAt: '2026-08-01T00:00:00.000Z',
  ttlDays: 90,
  currentCapsVersion: 'v2026-01',
  patternCapsVersion: 'v2026-01',
  today: '2026-09-15',
  now: '2026-09-15T10:00:00.000Z',
};

describe('runDecayCheck', () => {
  it('returns valid when TTL has not been exceeded', () => {
    const result = runDecayCheck(BASE);
    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    expect(result.tenantId).toBe(BASE.tenantId);
    expect(result.processedAt).toBe(BASE.now);
    expect(result.patternId).toBe(PATTERN.patternId);
  });

  it('daysUntilExpiry reflects elapsed days against TTL', () => {
    // Aug-01 to Sep-15 = 45 days elapsed; TTL 90 → 45 remaining
    const result = runDecayCheck(BASE);
    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    expect(result.daysUntilExpiry).toBe(45);
  });

  it('returns valid with daysUntilExpiry = ttlDays when revalidation passes', () => {
    const result = runDecayCheck({
      ...BASE,
      revalidationResult: { passRate: 0.85, requiredPassRate: 0.8 },
    });
    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    expect(result.daysUntilExpiry).toBe(BASE.ttlDays);
  });

  it('returns invalidated when CAPS version changed', () => {
    const result = runDecayCheck({
      ...BASE,
      currentCapsVersion: 'v2026-02',
      patternCapsVersion: 'v2026-01',
    });
    expect(result.status).toBe('invalidated');
    if (result.status !== 'invalidated') return;
    expect(result.reason).toBe('caps_version_change');
    expect(result.tenantId).toBe(BASE.tenantId);
    expect(result.patternId).toBe(PATTERN.patternId);
    expect(result.invalidatedAt).toBe(BASE.now);
  });

  it('invalidatedAt equals the injected now timestamp', () => {
    const customNow = '2026-10-01T12:00:00.000Z';
    const result = runDecayCheck({
      ...BASE,
      now: customNow,
      currentCapsVersion: 'v2026-02',
      patternCapsVersion: 'v2026-01',
    });
    expect(result.status).toBe('invalidated');
    if (result.status !== 'invalidated') return;
    expect(result.invalidatedAt).toBe(customNow);
  });

  it('returns invalidated when revalidation eval failed', () => {
    const result = runDecayCheck({
      ...BASE,
      revalidationResult: { passRate: 0.6, requiredPassRate: 0.8 },
    });
    expect(result.status).toBe('invalidated');
    if (result.status !== 'invalidated') return;
    expect(result.reason).toBe('revalidation_failed');
    expect(result.detail).toMatch(/0\.60/);
  });

  it('returns revalidation_required when TTL exceeded', () => {
    // Jun-01 to Sep-15 = 106 days > 90 TTL
    const result = runDecayCheck({
      ...BASE,
      lastValidatedAt: '2026-06-01T00:00:00.000Z',
    });
    expect(result.status).toBe('revalidation_required');
    if (result.status !== 'revalidation_required') return;
    expect(result.reason).toBe('ttl_exceeded');
    expect(result.tenantId).toBe(BASE.tenantId);
    expect(result.patternId).toBe(PATTERN.patternId);
  });

  it('revalidation_required detail names the elapsed days and TTL', () => {
    const result = runDecayCheck({
      ...BASE,
      lastValidatedAt: '2026-06-01T00:00:00.000Z',
    });
    expect(result.status).toBe('revalidation_required');
    if (result.status !== 'revalidation_required') return;
    expect(result.detail).toMatch(/106/);
    expect(result.detail).toMatch(/90/);
  });

  it('returns needs_input when pattern is absent', () => {
    const input: DecayCheckInput = {
      tenantId: BASE.tenantId,
      lastValidatedAt: BASE.lastValidatedAt,
      ttlDays: BASE.ttlDays,
      currentCapsVersion: BASE.currentCapsVersion,
      patternCapsVersion: BASE.patternCapsVersion,
      today: BASE.today,
      now: BASE.now,
    };
    const result = runDecayCheck(input);
    expect(result.status).toBe('needs_input');
    if (result.status !== 'needs_input') return;
    expect(result.missingFields).toContain('pattern');
  });

  it('needs_input carries processedAt from the injected now', () => {
    const input: DecayCheckInput = {
      tenantId: BASE.tenantId,
      lastValidatedAt: BASE.lastValidatedAt,
      ttlDays: BASE.ttlDays,
      currentCapsVersion: BASE.currentCapsVersion,
      patternCapsVersion: BASE.patternCapsVersion,
      today: BASE.today,
      now: BASE.now,
    };
    const result = runDecayCheck(input);
    expect(result.status).toBe('needs_input');
    if (result.status !== 'needs_input') return;
    expect(result.processedAt).toBe(BASE.now);
  });

  it('returns needs_input when lastValidatedAt is empty', () => {
    const result = runDecayCheck({ ...BASE, lastValidatedAt: '' });
    expect(result.status).toBe('needs_input');
    if (result.status !== 'needs_input') return;
    expect(result.missingFields).toContain('lastValidatedAt');
  });

  it('returns needs_input when today is empty', () => {
    const result = runDecayCheck({ ...BASE, today: '' });
    expect(result.status).toBe('needs_input');
    if (result.status !== 'needs_input') return;
    expect(result.missingFields).toContain('today');
  });
});
