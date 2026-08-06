import { describe, expect, it } from 'vitest';

import { MUST_NOT_REGRESS_TAG } from '../src/case.js';
import { evaluateGate } from '../src/gate.js';
import type { CaseResult, EvalRunResult } from '../src/runner.js';

function caseResult(overrides: Partial<CaseResult> = {}): CaseResult {
  return {
    caseId: 'a',
    agentId: 'CE-05',
    tags: [],
    passed: true,
    expectationResults: [],
    output: {},
    tokensUsed: null,
    costUsd: null,
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
      totalTokens: 0,
      totalCostUsd: 0,
      totalLatencyMs: 0,
    },
  };
}

describe('evaluateGate', () => {
  it('passes when there is no baseline yet', () => {
    const current = runResult([caseResult({ passed: false })], 0);
    expect(evaluateGate(current, null, { maxPassRateDrop: 0 })).toEqual({ ok: true });
  });

  it('passes when the pass rate is unchanged', () => {
    const baseline = runResult([caseResult()], 0.9);
    const current = runResult([caseResult()], 0.9);
    expect(evaluateGate(current, baseline, { maxPassRateDrop: 0 })).toEqual({ ok: true });
  });

  it('passes a small drop within the declared tolerance', () => {
    const baseline = runResult([caseResult()], 0.9);
    const current = runResult([caseResult()], 0.87);
    expect(evaluateGate(current, baseline, { maxPassRateDrop: 0.05 }).ok).toBe(true);
  });

  it('fails a drop beyond the declared tolerance', () => {
    const baseline = runResult([caseResult()], 0.9);
    const current = runResult([caseResult()], 0.7);
    const verdict = evaluateGate(current, baseline, { maxPassRateDrop: 0.05 });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.refusals.map((r) => r.code)).toEqual(['pass_rate_regressed']);
    }
  });

  it('an improvement in pass rate never fails the gate', () => {
    const baseline = runResult([caseResult()], 0.5);
    const current = runResult([caseResult()], 0.9);
    expect(evaluateGate(current, baseline, { maxPassRateDrop: 0 }).ok).toBe(true);
  });

  it('fails outright on any must_not_regress case regression, even within pass-rate tolerance', () => {
    const baseline = runResult(
      [caseResult({ caseId: 'a', passed: true, tags: [MUST_NOT_REGRESS_TAG] })],
      1,
    );
    const current = runResult(
      [caseResult({ caseId: 'a', passed: false, tags: [MUST_NOT_REGRESS_TAG] })],
      0.99,
    );
    const verdict = evaluateGate(current, baseline, { maxPassRateDrop: 1 });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.refusals.map((r) => r.code)).toEqual([
        'must_not_regress_case_failed',
      ]);
    }
  });

  it('a regressed case with no must_not_regress tag does not itself fail the gate', () => {
    const baseline = runResult([caseResult({ caseId: 'a', passed: true })], 1);
    const current = runResult([caseResult({ caseId: 'a', passed: false })], 0.99);
    expect(evaluateGate(current, baseline, { maxPassRateDrop: 1 }).ok).toBe(true);
  });

  it('reports both failing checks together when both apply', () => {
    const baseline = runResult(
      [caseResult({ caseId: 'a', passed: true, tags: [MUST_NOT_REGRESS_TAG] })],
      1,
    );
    const current = runResult(
      [caseResult({ caseId: 'a', passed: false, tags: [MUST_NOT_REGRESS_TAG] })],
      0,
    );
    const verdict = evaluateGate(current, baseline, { maxPassRateDrop: 0 });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.refusals.map((r) => r.code).sort()).toEqual(
        ['must_not_regress_case_failed', 'pass_rate_regressed'].sort(),
      );
    }
  });
});
