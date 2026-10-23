import type { EvalCase } from '@infinite-ai/evals';
import { describe, expect, it } from 'vitest';

import type { AgentCallRecord } from '../../src/dev/agent-runner.js';
import { runLiveEval } from '../../src/dev/live-eval.js';

const record = (over: Partial<AgentCallRecord>): AgentCallRecord => ({
  agentId: 'CE-01',
  label: 'x',
  contractVersion: '1.0.0',
  promptVersion: '1.0.0',
  logicalModel: 'curriculum.map',
  tenantId: 't',
  startedAt: '2026-01-01T00:00:00.000Z',
  latencyMs: 5,
  input: {},
  outcome: 'ok',
  rawContent: '{"status":"needs_input"}',
  output: { status: 'needs_input' },
  provider: 'local',
  cached: false,
  usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
  gatewayStatus: 200,
  error: null,
  inputIssues: [],
  ...over,
});

const makeCase = (id: string, expectations: EvalCase['expectations']): EvalCase => ({
  id,
  agentId: 'CE-01',
  input: {},
  context: {},
  expectations,
  tags: [],
  source: 'specification',
});

describe('runLiveEval', () => {
  it('scores a passing and a failing case, and reports every record as it arrives', async () => {
    const seen: string[] = [];
    const summary = await runLiveEval(
      'CE-01',
      '1.0.0',
      [
        makeCase('pass', [
          { type: 'exact_match', field: 'status', value: 'needs_input' },
        ]),
        makeCase('fail', [{ type: 'exact_match', field: 'status', value: 'ok' }]),
      ],
      { runCase: async () => record({}), onRecord: (r) => seen.push(r.label) },
    );
    expect(summary.counts).toMatchObject({ passed: 1, failed: 1 });
    expect(summary.cases[1]?.failedExpectations).toHaveLength(1);
    expect(seen).toHaveLength(2);
  });

  it('does not score llm_judge expectations, and calls a judge-only case unscored', async () => {
    const summary = await runLiveEval(
      'CE-01',
      '1.0.0',
      [
        makeCase('judge-only', [{ type: 'llm_judge', criterion: 'tone', minScore: 0.8 }]),
        makeCase('mixed', [
          { type: 'exact_match', field: 'status', value: 'needs_input' },
          { type: 'llm_judge', criterion: 'tone', minScore: 0.8 },
        ]),
      ],
      { runCase: async () => record({}) },
    );
    expect(summary.cases[0]).toMatchObject({
      status: 'unscored',
      deferredJudgeExpectations: 1,
    });
    expect(summary.cases[1]).toMatchObject({
      status: 'passed',
      deferredJudgeExpectations: 1,
    });
  });

  it('marks a case whose model call failed as call_failed, not as a wrong answer', async () => {
    const summary = await runLiveEval(
      'CE-01',
      '1.0.0',
      [makeCase('c', [{ type: 'exact_match', field: 'status', value: 'ok' }])],
      {
        runCase: async () =>
          record({ outcome: 'non_json', output: undefined, error: 'not JSON' }),
      },
    );
    expect(summary.cases[0]).toMatchObject({
      status: 'call_failed',
      outcome: 'non_json',
    });
    expect(summary.counts.call_failed).toBe(1);
  });
});
