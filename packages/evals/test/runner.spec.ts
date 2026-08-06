import { describe, expect, it } from 'vitest';

import type { EvalCase } from '../src/case.js';
import {
  EvalRunnerError,
  diffAgainstChampion,
  runEvalSet,
  type AgentExecutor,
  type EvalRunResult,
} from '../src/runner.js';
import type { LlmJudge } from '../src/scorers.js';

function evalCase(overrides: Partial<EvalCase> = {}): EvalCase {
  return {
    id: 'case-1',
    agentId: 'CE-05',
    input: { topic: 'fractions' },
    context: {},
    expectations: [{ type: 'exact_match', field: 'status', value: 'ok' }],
    tags: [],
    source: 'specification',
    ...overrides,
  };
}

describe('runEvalSet', () => {
  it('refuses a set containing a case built for a different agent', async () => {
    const cases = [
      evalCase({ id: 'a', agentId: 'CE-05' }),
      evalCase({ id: 'b', agentId: 'CE-06' }),
    ];
    const executeAgent: AgentExecutor = async () => ({ output: { status: 'ok' } });
    await expect(runEvalSet('CE-05', '1.0.0', cases, { executeAgent })).rejects.toThrow(
      EvalRunnerError,
    );
  });

  it('scores a passing case as passed, and a failing case as not passed', async () => {
    const cases = [
      evalCase({
        id: 'pass',
        expectations: [{ type: 'exact_match', field: 'status', value: 'ok' }],
      }),
      evalCase({
        id: 'fail',
        expectations: [{ type: 'exact_match', field: 'status', value: 'ok' }],
      }),
    ];
    const executeAgent: AgentExecutor = async (c) => ({
      output: { status: c.id === 'pass' ? 'ok' : 'error' },
    });
    const result = await runEvalSet('CE-05', '1.0.0', cases, { executeAgent });

    expect(result.cases.find((c) => c.caseId === 'pass')?.passed).toBe(true);
    expect(result.cases.find((c) => c.caseId === 'fail')?.passed).toBe(false);
  });

  it('a case passes only when every one of its expectations passes', async () => {
    const cases = [
      evalCase({
        expectations: [
          { type: 'exact_match', field: 'status', value: 'ok' },
          { type: 'numeric_tolerance', field: 'score', expected: 10, tolerance: 0 },
        ],
      }),
    ];
    const executeAgent: AgentExecutor = async () => ({
      output: { status: 'ok', score: 999 },
    });
    const result = await runEvalSet('CE-05', '1.0.0', cases, { executeAgent });

    expect(result.cases[0]?.passed).toBe(false);
    expect(result.cases[0]?.expectationResults).toHaveLength(2);
  });

  it('captures tokensUsed and costUsd reported by the executor', async () => {
    const cases = [evalCase()];
    const executeAgent: AgentExecutor = async () => ({
      output: { status: 'ok' },
      tokensUsed: 120,
      costUsd: 0.02,
    });
    const result = await runEvalSet('CE-05', '1.0.0', cases, { executeAgent });

    expect(result.cases[0]?.tokensUsed).toBe(120);
    expect(result.cases[0]?.costUsd).toBe(0.02);
    expect(result.metrics.totalTokens).toBe(120);
    expect(result.metrics.totalCostUsd).toBe(0.02);
  });

  it('scores a case whose executor throws as a failed case, without crashing the run', async () => {
    const cases = [evalCase({ id: 'boom' }), evalCase({ id: 'ok2' })];
    const executeAgent: AgentExecutor = async (c) => {
      if (c.id === 'boom') throw new Error('provider timed out');
      return { output: { status: 'ok' } };
    };
    const result = await runEvalSet('CE-05', '1.0.0', cases, { executeAgent });

    const boom = result.cases.find((c) => c.caseId === 'boom');
    expect(boom?.passed).toBe(false);
    expect(boom?.error).toBe('provider timed out');
    expect(boom?.expectationResults).toEqual([]);
    expect(result.cases.find((c) => c.caseId === 'ok2')?.passed).toBe(true);
  });

  it('computes aggregate metrics correctly, including passRate', async () => {
    const cases = [evalCase({ id: 'a' }), evalCase({ id: 'b' }), evalCase({ id: 'c' })];
    const executeAgent: AgentExecutor = async (c) => ({
      output: { status: c.id === 'c' ? 'error' : 'ok' },
    });
    const result = await runEvalSet('CE-05', '1.0.0', cases, { executeAgent });

    expect(result.metrics.totalCases).toBe(3);
    expect(result.metrics.passedCases).toBe(2);
    expect(result.metrics.failedCases).toBe(1);
    expect(result.metrics.passRate).toBeCloseTo(2 / 3);
  });

  it('passRate is 0, not NaN, for an empty case list', async () => {
    const executeAgent: AgentExecutor = async () => ({ output: {} });
    const result = await runEvalSet('CE-05', '1.0.0', [], { executeAgent });
    expect(result.metrics.totalCases).toBe(0);
    expect(result.metrics.passRate).toBe(0);
  });

  it('threads the case rubric and an injected judge through to an llm_judge expectation', async () => {
    const cases = [
      evalCase({
        expectations: [{ type: 'llm_judge', minScore: 4 }],
        rubric: 'Score the tone 1-5.',
      }),
    ];
    const judge: LlmJudge = async (rubric) => ({
      score: rubric === 'Score the tone 1-5.' ? 5 : 1,
      rationale: 'x',
    });
    const executeAgent: AgentExecutor = async () => ({ output: { text: 'hi' } });
    const result = await runEvalSet('CE-05', '1.0.0', cases, { executeAgent, judge });

    expect(result.cases[0]?.passed).toBe(true);
  });

  it('threads templateFidelityCheckers through to a template_fidelity expectation', async () => {
    const cases = [
      evalCase({ expectations: [{ type: 'template_fidelity', templateId: 't1' }] }),
    ];
    const executeAgent: AgentExecutor = async () => ({ output: { ok: false } });
    const result = await runEvalSet('CE-05', '1.0.0', cases, {
      executeAgent,
      templateFidelityCheckers: { t1: (output) => (output as { ok: boolean }).ok },
    });

    expect(result.cases[0]?.passed).toBe(false);
  });

  it('runs cases in the order supplied', async () => {
    const order: string[] = [];
    const cases = [evalCase({ id: 'first' }), evalCase({ id: 'second' })];
    const executeAgent: AgentExecutor = async (c) => {
      order.push(c.id);
      return { output: { status: 'ok' } };
    };
    await runEvalSet('CE-05', '1.0.0', cases, { executeAgent });
    expect(order).toEqual(['first', 'second']);
  });
});

describe('diffAgainstChampion', () => {
  function runResult(
    cases: { caseId: string; passed: boolean; tags?: string[] }[],
  ): EvalRunResult {
    return {
      agentId: 'CE-05',
      agentVersion: '1.0.0',
      cases: cases.map((c) => ({
        caseId: c.caseId,
        agentId: 'CE-05',
        tags: c.tags ?? [],
        passed: c.passed,
        expectationResults: [],
        output: {},
        tokensUsed: null,
        costUsd: null,
        latencyMs: 0,
        error: null,
      })),
      metrics: {
        totalCases: cases.length,
        passedCases: cases.filter((c) => c.passed).length,
        failedCases: cases.filter((c) => !c.passed).length,
        passRate: 0,
        totalTokens: 0,
        totalCostUsd: 0,
        totalLatencyMs: 0,
      },
    };
  }

  it('when there is no champion, every case is new and nothing regresses or improves', () => {
    const challenger = runResult([{ caseId: 'a', passed: true }]);
    const diff = diffAgainstChampion(challenger, null);

    expect(diff.newCaseIds).toEqual(['a']);
    expect(diff.regressedCaseIds).toEqual([]);
    expect(diff.improvedCaseIds).toEqual([]);
    expect(diff.cases[0]?.championPassed).toBeNull();
  });

  it('flags a case that passed under the champion and fails under the challenger as regressed', () => {
    const champion = runResult([{ caseId: 'a', passed: true }]);
    const challenger = runResult([{ caseId: 'a', passed: false }]);
    const diff = diffAgainstChampion(challenger, champion);

    expect(diff.regressedCaseIds).toEqual(['a']);
    expect(diff.improvedCaseIds).toEqual([]);
  });

  it('flags a case that failed under the champion and passes under the challenger as improved', () => {
    const champion = runResult([{ caseId: 'a', passed: false }]);
    const challenger = runResult([{ caseId: 'a', passed: true }]);
    const diff = diffAgainstChampion(challenger, champion);

    expect(diff.improvedCaseIds).toEqual(['a']);
    expect(diff.regressedCaseIds).toEqual([]);
  });

  it('a case unchanged across both runs is neither regressed nor improved', () => {
    const champion = runResult([{ caseId: 'a', passed: true }]);
    const challenger = runResult([{ caseId: 'a', passed: true }]);
    const diff = diffAgainstChampion(challenger, champion);

    expect(diff.regressedCaseIds).toEqual([]);
    expect(diff.improvedCaseIds).toEqual([]);
    expect(diff.newCaseIds).toEqual([]);
  });

  it('a case the challenger has but the champion does not is new, not a regression', () => {
    const champion = runResult([{ caseId: 'a', passed: true }]);
    const challenger = runResult([
      { caseId: 'a', passed: true },
      { caseId: 'b', passed: false },
    ]);
    const diff = diffAgainstChampion(challenger, champion);

    expect(diff.newCaseIds).toEqual(['b']);
    expect(diff.regressedCaseIds).toEqual([]);
  });

  it("carries each case's own tags through into the diff", () => {
    const champion = runResult([
      { caseId: 'a', passed: true, tags: ['must_not_regress'] },
    ]);
    const challenger = runResult([
      { caseId: 'a', passed: false, tags: ['must_not_regress'] },
    ]);
    const diff = diffAgainstChampion(challenger, champion);

    expect(diff.cases[0]?.tags).toEqual(['must_not_regress']);
  });
});
