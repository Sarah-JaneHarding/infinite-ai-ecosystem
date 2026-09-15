// Eval Gatekeeper unit tests — Stage 13 step 5.
//
// "A promotion that fails eval is rejected" (manual step 5).
// Covers: ok/promote, ok/reject_*, needs_input paths, summary format, timestamps.

import { describe, expect, it } from 'vitest';

import { type EvalGatekeeperInput, gateChallenger } from '../src/index.js';

const CHAMPION = {
  overallPassRate: 0.8,
  mustNotRegressPassRate: 1.0,
  totalCases: 20,
  mustNotRegressCases: 5,
};

const CHALLENGER_BETTER = {
  overallPassRate: 0.9,
  mustNotRegressPassRate: 1.0,
  totalCases: 20,
  mustNotRegressCases: 5,
};

const BASE: EvalGatekeeperInput = {
  tenantId: '00000000-0000-0000-0000-000000000001',
  agentId: 'agent-01',
  challengerId: '00000000-0000-0000-0000-000000000002',
  now: '2026-09-15T10:00:00.000Z',
  championEvalResult: CHAMPION,
  challengerEvalResult: CHALLENGER_BETTER,
};

describe('gateChallenger', () => {
  it('returns ok/promote when challenger beats champion on all dimensions', () => {
    const result = gateChallenger(BASE);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.verdict).toBe('promote');
    expect(result.tenantId).toBe(BASE.tenantId);
    expect(result.evaluatedAt).toBe(BASE.now);
    expect(result.processedAt).toBe(BASE.now);
    expect(result.scoreDelta).toBeCloseTo(0.1);
    expect(result.mustNotRegressDelta).toBeCloseTo(0);
  });

  it('returns needs_input when championEvalResult is absent', () => {
    const input: EvalGatekeeperInput = {
      tenantId: BASE.tenantId,
      agentId: BASE.agentId,
      challengerId: BASE.challengerId,
      now: BASE.now,
      challengerEvalResult: CHALLENGER_BETTER,
    };
    const result = gateChallenger(input);
    expect(result.status).toBe('needs_input');
    if (result.status !== 'needs_input') return;
    expect(result.missingFields).toContain('championEvalResult');
    expect(result.detail).toMatch(/championEvalResult/);
  });

  it('returns needs_input when challengerEvalResult is absent', () => {
    const input: EvalGatekeeperInput = {
      tenantId: BASE.tenantId,
      agentId: BASE.agentId,
      challengerId: BASE.challengerId,
      now: BASE.now,
      championEvalResult: CHAMPION,
    };
    const result = gateChallenger(input);
    expect(result.status).toBe('needs_input');
    if (result.status !== 'needs_input') return;
    expect(result.missingFields).toContain('challengerEvalResult');
    expect(result.detail).toMatch(/challengerEvalResult/);
  });

  it('returns needs_input with both fields listed when both eval results are absent', () => {
    const input: EvalGatekeeperInput = {
      tenantId: BASE.tenantId,
      agentId: BASE.agentId,
      challengerId: BASE.challengerId,
      now: BASE.now,
    };
    const result = gateChallenger(input);
    expect(result.status).toBe('needs_input');
    if (result.status !== 'needs_input') return;
    expect(result.missingFields).toContain('championEvalResult');
    expect(result.missingFields).toContain('challengerEvalResult');
    expect(result.missingFields).toHaveLength(2);
  });

  it('returns ok/reject_regression when mustNotRegressPassRate drops', () => {
    const result = gateChallenger({
      ...BASE,
      challengerEvalResult: {
        overallPassRate: 0.95,
        mustNotRegressPassRate: 0.8,
        totalCases: 20,
        mustNotRegressCases: 5,
      },
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.verdict).toBe('reject_regression');
    expect(result.mustNotRegressDelta).toBeLessThan(0);
  });

  it('returns ok/reject_no_improvement when overall score is equal', () => {
    const result = gateChallenger({
      ...BASE,
      challengerEvalResult: {
        overallPassRate: 0.8,
        mustNotRegressPassRate: 1.0,
        totalCases: 20,
        mustNotRegressCases: 5,
      },
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.verdict).toBe('reject_no_improvement');
    expect(result.scoreDelta).toBeCloseTo(0);
  });

  it('returns ok/reject_no_improvement when overall score decreases', () => {
    const result = gateChallenger({
      ...BASE,
      challengerEvalResult: {
        overallPassRate: 0.75,
        mustNotRegressPassRate: 1.0,
        totalCases: 20,
        mustNotRegressCases: 5,
      },
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.verdict).toBe('reject_no_improvement');
    expect(result.scoreDelta).toBeLessThan(0);
  });

  it('returns ok/reject_bias_divergence when biasCheckPassed is false', () => {
    const result = gateChallenger({ ...BASE, biasCheckPassed: false });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.verdict).toBe('reject_bias_divergence');
  });

  it('does not reject for bias when biasCheckPassed is absent (treat as not run)', () => {
    const result = gateChallenger(BASE);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.verdict).toBe('promote');
  });

  it('evalDeltaSummary encodes verdict, overallPassRate, and mustNotRegress', () => {
    const result = gateChallenger(BASE);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.evalDeltaSummary).toMatch(/verdict=promote/);
    expect(result.evalDeltaSummary).toMatch(/overallPassRate/);
    expect(result.evalDeltaSummary).toMatch(/mustNotRegress/);
  });

  it('evalDeltaSummary encodes the rejection reason for reject_regression', () => {
    const result = gateChallenger({
      ...BASE,
      challengerEvalResult: {
        overallPassRate: 0.9,
        mustNotRegressPassRate: 0.6,
        totalCases: 20,
        mustNotRegressCases: 5,
      },
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.evalDeltaSummary).toMatch(/verdict=reject_regression/);
  });

  it('processedAt and evaluatedAt both reflect the injected now timestamp', () => {
    const customNow = '2026-01-01T00:00:00.000Z';
    const result = gateChallenger({ ...BASE, now: customNow });
    expect(result.processedAt).toBe(customNow);
    if (result.status === 'ok') {
      expect(result.evaluatedAt).toBe(customNow);
    }
  });
});
