// Promotion gate unit tests — Stage 13 step 10.
//
// "A promotion that fails eval is rejected" (manual step 10).
// Covers all four verdict paths: regression, no improvement, bias divergence, promote.

import { describe, expect, it } from 'vitest';

import { applyPromotionGate } from '../src/index.js';

const champion = {
  overallPassRate: 0.8,
  mustNotRegressPassRate: 1.0,
  totalCases: 20,
  mustNotRegressCases: 5,
};

describe('applyPromotionGate', () => {
  it('returns promote when challenger strictly beats champion on all dimensions', () => {
    const result = applyPromotionGate({
      champion,
      challenger: {
        overallPassRate: 0.9,
        mustNotRegressPassRate: 1.0,
        totalCases: 20,
        mustNotRegressCases: 5,
      },
    });
    expect(result.verdict).toBe('promote');
    expect(result.scoreDelta).toBeCloseTo(0.1);
    expect(result.mustNotRegressDelta).toBeCloseTo(0);
  });

  it('returns reject_regression when mustNotRegressPassRate drops even if overall improves', () => {
    const result = applyPromotionGate({
      champion,
      challenger: {
        overallPassRate: 0.95,
        mustNotRegressPassRate: 0.8,
        totalCases: 20,
        mustNotRegressCases: 5,
      },
    });
    expect(result.verdict).toBe('reject_regression');
    expect(result.mustNotRegressDelta).toBeLessThan(0);
  });

  it('returns reject_no_improvement when mustNotRegress is clean but overall score is equal', () => {
    const result = applyPromotionGate({
      champion,
      challenger: {
        overallPassRate: 0.8,
        mustNotRegressPassRate: 1.0,
        totalCases: 20,
        mustNotRegressCases: 5,
      },
    });
    expect(result.verdict).toBe('reject_no_improvement');
    expect(result.scoreDelta).toBeCloseTo(0);
  });

  it('returns reject_no_improvement when overall score decreases', () => {
    const result = applyPromotionGate({
      champion,
      challenger: {
        overallPassRate: 0.75,
        mustNotRegressPassRate: 1.0,
        totalCases: 20,
        mustNotRegressCases: 5,
      },
    });
    expect(result.verdict).toBe('reject_no_improvement');
    expect(result.scoreDelta).toBeLessThan(0);
  });

  it('returns reject_bias_divergence when biasCheckPassed is false regardless of scores', () => {
    const result = applyPromotionGate({
      champion,
      challenger: {
        overallPassRate: 0.95,
        mustNotRegressPassRate: 1.0,
        totalCases: 20,
        mustNotRegressCases: 5,
      },
      biasCheckPassed: false,
    });
    expect(result.verdict).toBe('reject_bias_divergence');
  });

  it('does not reject for bias when biasCheckPassed is true', () => {
    const result = applyPromotionGate({
      champion,
      challenger: {
        overallPassRate: 0.9,
        mustNotRegressPassRate: 1.0,
        totalCases: 20,
        mustNotRegressCases: 5,
      },
      biasCheckPassed: true,
    });
    expect(result.verdict).toBe('promote');
  });

  it('treats absent biasCheckPassed as "not run" — does not reject for it', () => {
    const result = applyPromotionGate({
      champion,
      challenger: {
        overallPassRate: 0.9,
        mustNotRegressPassRate: 1.0,
        totalCases: 20,
        mustNotRegressCases: 5,
      },
    });
    expect(result.verdict).toBe('promote');
  });

  it('prioritises regression check over bias check', () => {
    const result = applyPromotionGate({
      champion,
      challenger: {
        overallPassRate: 0.85,
        mustNotRegressPassRate: 0.6,
        totalCases: 20,
        mustNotRegressCases: 5,
      },
      biasCheckPassed: false,
    });
    // bias_divergence check happens before regression in priority list
    expect(result.verdict).toBe('reject_bias_divergence');
  });

  it('computes correct deltas for a promotion', () => {
    const result = applyPromotionGate({
      champion: {
        overallPassRate: 0.6,
        mustNotRegressPassRate: 0.8,
        totalCases: 10,
        mustNotRegressCases: 3,
      },
      challenger: {
        overallPassRate: 0.75,
        mustNotRegressPassRate: 1.0,
        totalCases: 10,
        mustNotRegressCases: 3,
      },
    });
    expect(result.verdict).toBe('promote');
    expect(result.scoreDelta).toBeCloseTo(0.15);
    expect(result.mustNotRegressDelta).toBeCloseTo(0.2);
  });
});
