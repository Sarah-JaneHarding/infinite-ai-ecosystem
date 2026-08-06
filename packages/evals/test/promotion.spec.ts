import { describe, expect, it } from 'vitest';

import type { AgentBudget } from '@infinite-ai/agents';

import { MUST_NOT_REGRESS_TAG } from '../src/case.js';
import { decidePromotion, type PromotionReview } from '../src/promotion.js';
import type { CaseResult, EvalRunResult } from '../src/runner.js';

const BUDGET: AgentBudget = { maxTokens: 1000, maxCostUsd: 1 };
const APPROVED: PromotionReview = {
  approved: true,
  decidedBy: 'hod-1',
  reason: 'Looks good.',
};

function caseResult(overrides: Partial<CaseResult> = {}): CaseResult {
  return {
    caseId: 'a',
    agentId: 'CE-05',
    tags: [],
    passed: true,
    expectationResults: [],
    output: {},
    tokensUsed: 100,
    costUsd: 0.01,
    latencyMs: 0,
    error: null,
    ...overrides,
  };
}

function runResult(cases: CaseResult[], passRate: number): EvalRunResult {
  return {
    agentId: 'CE-05',
    agentVersion: '1.0.0',
    cases,
    metrics: {
      totalCases: cases.length,
      passedCases: cases.filter((c) => c.passed).length,
      failedCases: cases.filter((c) => !c.passed).length,
      passRate,
      totalTokens: cases.reduce((sum, c) => sum + (c.tokensUsed ?? 0), 0),
      totalCostUsd: cases.reduce((sum, c) => sum + (c.costUsd ?? 0), 0),
      totalLatencyMs: 0,
    },
  };
}

describe('decidePromotion — no champion yet (first run)', () => {
  it('promotes when budget is fine and a human approved', () => {
    const challenger = runResult([caseResult()], 1);
    const verdict = decidePromotion(challenger, null, {
      budget: BUDGET,
      humanReview: APPROVED,
    });
    expect(verdict.promote).toBe(true);
  });

  it('refuses with over_budget when a case exceeds the declared budget, even with no champion', () => {
    const challenger = runResult([caseResult({ tokensUsed: 5000 })], 1);
    const verdict = decidePromotion(challenger, null, {
      budget: BUDGET,
      humanReview: APPROVED,
    });
    expect(verdict.promote).toBe(false);
    if (!verdict.promote) {
      expect(verdict.refusals.map((r) => r.code)).toEqual(['over_budget']);
    }
  });

  it('refuses with human_review_missing when no review has been recorded', () => {
    const challenger = runResult([caseResult()], 1);
    const verdict = decidePromotion(challenger, null, {
      budget: BUDGET,
      humanReview: null,
    });
    expect(verdict.promote).toBe(false);
    if (!verdict.promote) {
      expect(verdict.refusals.map((r) => r.code)).toEqual(['human_review_missing']);
    }
  });
});

describe('decidePromotion — with a champion', () => {
  it('promotes when the challenger beats the champion, regresses nothing, fits budget, and is approved', () => {
    const champion = runResult([caseResult({ caseId: 'a', passed: true })], 0.5);
    const challenger = runResult([caseResult({ caseId: 'a', passed: true })], 0.8);
    const verdict = decidePromotion(challenger, champion, {
      budget: BUDGET,
      humanReview: APPROVED,
    });
    expect(verdict.promote).toBe(true);
  });

  it('refuses with primary_metric_not_improved when the challenger does not beat the champion', () => {
    const champion = runResult([caseResult()], 0.9);
    const challenger = runResult([caseResult()], 0.8);
    const verdict = decidePromotion(challenger, champion, {
      budget: BUDGET,
      humanReview: APPROVED,
    });
    expect(verdict.promote).toBe(false);
    if (!verdict.promote) {
      expect(verdict.refusals.map((r) => r.code)).toContain(
        'primary_metric_not_improved',
      );
    }
  });

  it('an equal primary metric does not count as beating the champion', () => {
    const champion = runResult([caseResult()], 0.8);
    const challenger = runResult([caseResult()], 0.8);
    const verdict = decidePromotion(challenger, champion, {
      budget: BUDGET,
      humanReview: APPROVED,
    });
    expect(verdict.promote).toBe(false);
  });

  it('refuses with must_not_regress_case_failed when a tagged case regresses', () => {
    const champion = runResult(
      [caseResult({ caseId: 'a', passed: true, tags: [MUST_NOT_REGRESS_TAG] })],
      0.5,
    );
    const challenger = runResult(
      [caseResult({ caseId: 'a', passed: false, tags: [MUST_NOT_REGRESS_TAG] })],
      0.8,
    );
    const verdict = decidePromotion(challenger, champion, {
      budget: BUDGET,
      humanReview: APPROVED,
    });
    expect(verdict.promote).toBe(false);
    if (!verdict.promote) {
      expect(verdict.refusals.map((r) => r.code)).toContain(
        'must_not_regress_case_failed',
      );
    }
  });

  it('a regressed case with no must_not_regress tag does not itself block promotion', () => {
    const champion = runResult([caseResult({ caseId: 'a', passed: true })], 0.5);
    const challenger = runResult([caseResult({ caseId: 'a', passed: false })], 0.8);
    const verdict = decidePromotion(challenger, champion, {
      budget: BUDGET,
      humanReview: APPROVED,
    });
    expect(verdict.promote).toBe(true);
  });

  it('refuses with human_review_not_approved when a reviewer explicitly rejects', () => {
    const champion = runResult([caseResult()], 0.5);
    const challenger = runResult([caseResult()], 0.8);
    const verdict = decidePromotion(challenger, champion, {
      budget: BUDGET,
      humanReview: { approved: false, decidedBy: 'hod-1', reason: 'Not ready.' },
    });
    expect(verdict.promote).toBe(false);
    if (!verdict.promote) {
      expect(verdict.refusals.map((r) => r.code)).toEqual(['human_review_not_approved']);
    }
  });

  it('collects every failing gate at once, not just the first', () => {
    const champion = runResult(
      [caseResult({ caseId: 'a', passed: true, tags: [MUST_NOT_REGRESS_TAG] })],
      0.9,
    );
    const challenger = runResult(
      [
        caseResult({
          caseId: 'a',
          passed: false,
          tags: [MUST_NOT_REGRESS_TAG],
          tokensUsed: 5000,
        }),
      ],
      0.8,
    );
    const verdict = decidePromotion(challenger, champion, {
      budget: BUDGET,
      humanReview: null,
    });
    expect(verdict.promote).toBe(false);
    if (!verdict.promote) {
      expect(verdict.refusals.map((r) => r.code).sort()).toEqual(
        [
          'human_review_missing',
          'must_not_regress_case_failed',
          'over_budget',
          'primary_metric_not_improved',
        ].sort(),
      );
    }
  });

  it('uses a custom primaryMetric function when supplied', () => {
    const champion = runResult([caseResult({ costUsd: 0.5 })], 1);
    const challenger = runResult([caseResult({ costUsd: 0.1 })], 1);
    // Lower cost is "better" under this custom metric, even though passRate is tied.
    const verdict = decidePromotion(challenger, champion, {
      budget: BUDGET,
      humanReview: APPROVED,
      primaryMetric: (r) => -r.metrics.totalCostUsd,
    });
    expect(verdict.promote).toBe(true);
  });
});
