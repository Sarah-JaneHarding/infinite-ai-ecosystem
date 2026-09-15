// Ratification Surface unit tests — Stage 13 step 6.
//
// "Build the ratification surface showing the candidate, the evidence, the eval delta
// and the rollback command" (manual step 6).

import { describe, expect, it } from 'vitest';

import {
  type RatificationPackageInput,
  composeRatificationPackage,
} from '../src/index.js';

const BASE: RatificationPackageInput = {
  tenantId: '00000000-0000-0000-0000-000000000001',
  agentId: 'agent-le06',
  challengerId: '00000000-0000-0000-0000-000000000002',
  challengerVersion: 'v1.0.0+le06',
  previousChampionVersion: 'v1.0.0',
  evalDeltaSummary:
    'verdict=promote; overallPassRate: champion=0.8000, challenger=0.9000',
  gatekeeperVerdict: 'promote',
  evidenceSummary: 'Pattern observed in 14 corrections across Grade 4 Numeracy.',
  now: '2026-09-15T10:00:00.000Z',
};

describe('composeRatificationPackage', () => {
  it('returns ok with full display package when verdict is promote', () => {
    const result = composeRatificationPackage(BASE);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.tenantId).toBe(BASE.tenantId);
    expect(result.agentId).toBe(BASE.agentId);
    expect(result.challengerId).toBe(BASE.challengerId);
    expect(result.challengerVersion).toBe(BASE.challengerVersion);
    expect(result.previousChampionVersion).toBe(BASE.previousChampionVersion);
    expect(result.evalDeltaSummary).toBe(BASE.evalDeltaSummary);
    expect(result.evidenceSummary).toBe(BASE.evidenceSummary);
    expect(result.proposedAt).toBe(BASE.now);
  });

  it('rollbackPreview contains agentId and previousChampionVersion', () => {
    const result = composeRatificationPackage(BASE);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.rollbackPreview).toContain(BASE.agentId);
    expect(result.rollbackPreview).toContain(BASE.previousChampionVersion);
  });

  it('rollbackPreview contains the challengerId for traceability', () => {
    const result = composeRatificationPackage(BASE);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.rollbackPreview).toContain(BASE.challengerId);
  });

  it('returns not_eligible when verdict is reject_regression', () => {
    const result = composeRatificationPackage({
      ...BASE,
      gatekeeperVerdict: 'reject_regression',
    });
    expect(result.status).toBe('not_eligible');
    if (result.status !== 'not_eligible') return;
    expect(result.gatekeeperVerdict).toBe('reject_regression');
    expect(result.detail).toMatch(/reject_regression/);
  });

  it('returns not_eligible when verdict is reject_no_improvement', () => {
    const result = composeRatificationPackage({
      ...BASE,
      gatekeeperVerdict: 'reject_no_improvement',
    });
    expect(result.status).toBe('not_eligible');
    if (result.status !== 'not_eligible') return;
    expect(result.gatekeeperVerdict).toBe('reject_no_improvement');
  });

  it('returns not_eligible when verdict is reject_bias_divergence', () => {
    const result = composeRatificationPackage({
      ...BASE,
      gatekeeperVerdict: 'reject_bias_divergence',
    });
    expect(result.status).toBe('not_eligible');
    if (result.status !== 'not_eligible') return;
    expect(result.gatekeeperVerdict).toBe('reject_bias_divergence');
  });

  it('returns needs_input when challengerVersion is missing', () => {
    const result = composeRatificationPackage({ ...BASE, challengerVersion: '' });
    expect(result.status).toBe('needs_input');
    if (result.status !== 'needs_input') return;
    expect(result.missingFields).toContain('challengerVersion');
  });

  it('returns needs_input when previousChampionVersion is missing', () => {
    const result = composeRatificationPackage({ ...BASE, previousChampionVersion: '' });
    expect(result.status).toBe('needs_input');
    if (result.status !== 'needs_input') return;
    expect(result.missingFields).toContain('previousChampionVersion');
  });

  it('returns needs_input when evalDeltaSummary is missing', () => {
    const result = composeRatificationPackage({ ...BASE, evalDeltaSummary: '' });
    expect(result.status).toBe('needs_input');
    if (result.status !== 'needs_input') return;
    expect(result.missingFields).toContain('evalDeltaSummary');
  });

  it('evidenceSummary defaults to fallback when absent', () => {
    const { evidenceSummary: _, ...withoutEvidence } = BASE;
    const input: RatificationPackageInput = withoutEvidence;
    const result = composeRatificationPackage(input);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.evidenceSummary).toMatch(/No additional evidence/);
  });

  it('proposedAt reflects injected now timestamp', () => {
    const customNow = '2026-01-01T00:00:00.000Z';
    const result = composeRatificationPackage({ ...BASE, now: customNow });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.proposedAt).toBe(customNow);
  });
});
