import { describe, expect, it } from 'vitest';

import { MUST_NOT_REGRESS_TAG, type EvalCase } from '../src/case.js';
import {
  buildSafetyCase,
  isSafetyCase,
  selectCasesToRun,
  selectSafetyCases,
} from '../src/safety-set.js';

function ordinaryCase(id: string, agentId = 'CE-05'): EvalCase {
  return {
    id,
    agentId,
    input: {},
    context: {},
    expectations: [{ type: 'exact_match', field: 'status', value: 'ok' }],
    tags: [],
    source: 'specification',
  };
}

describe('buildSafetyCase', () => {
  it('tags the case with its own safety category and sets source to specification', () => {
    const evalCase = buildSafetyCase('pii_egress', {
      id: 'safety-1',
      agentId: 'CE-05',
      input: {},
      context: {},
      expectations: [{ type: 'refusal_correctness', shouldRefuse: true }],
    });
    expect(evalCase.tags).toEqual(['pii_egress']);
    expect(evalCase.source).toBe('specification');
  });

  it('appends any extraTags alongside the safety category', () => {
    const evalCase = buildSafetyCase('prompt_injection', {
      id: 'safety-2',
      agentId: 'CE-05',
      input: {},
      context: {},
      expectations: [{ type: 'refusal_correctness', shouldRefuse: true }],
      extraTags: [MUST_NOT_REGRESS_TAG],
    });
    expect(evalCase.tags).toEqual(['prompt_injection', MUST_NOT_REGRESS_TAG]);
  });

  it('throws for a malformed candidate the same way validateEvalCase does', () => {
    expect(() =>
      buildSafetyCase('pii_egress', {
        id: 'safety-3',
        agentId: 'CE-05',
        input: {},
        context: {},
        expectations: [],
      }),
    ).toThrow();
  });
});

describe('isSafetyCase / selectSafetyCases', () => {
  it('identifies a case tagged with any of the six safety categories', () => {
    const safety = buildSafetyCase('cross_tenant_leakage', {
      id: 's',
      agentId: 'CE-05',
      input: {},
      context: {},
      expectations: [{ type: 'exact_match', field: 'x', value: 1 }],
    });
    expect(isSafetyCase(safety)).toBe(true);
    expect(isSafetyCase(ordinaryCase('a'))).toBe(false);
  });

  it('selects only the safety-tagged cases from a mixed list', () => {
    const safety = buildSafetyCase('age_appropriateness', {
      id: 's',
      agentId: 'CE-05',
      input: {},
      context: {},
      expectations: [{ type: 'exact_match', field: 'x', value: 1 }],
    });
    const cases = [ordinaryCase('a'), safety, ordinaryCase('b')];
    expect(selectSafetyCases(cases)).toEqual([safety]);
  });
});

describe('selectCasesToRun', () => {
  it('returns every case when affected is "all"', () => {
    const cases = [ordinaryCase('a'), ordinaryCase('b')];
    expect(selectCasesToRun(cases, 'all')).toEqual(cases);
  });

  it("includes only affected agents' cases when nothing is safety-tagged", () => {
    const cases = [ordinaryCase('a', 'CE-05'), ordinaryCase('b', 'CE-06')];
    const selected = selectCasesToRun(cases, ['CE-05']);
    expect(selected.map((c) => c.id)).toEqual(['a']);
  });

  it('always includes safety-tagged cases regardless of which agents are affected', () => {
    const safetyForOtherAgent = buildSafetyCase('safeguarding_escalation', {
      id: 'safety',
      agentId: 'CE-99',
      input: {},
      context: {},
      expectations: [{ type: 'exact_match', field: 'x', value: 1 }],
    });
    const cases = [
      ordinaryCase('a', 'CE-05'),
      ordinaryCase('b', 'CE-06'),
      safetyForOtherAgent,
    ];
    const selected = selectCasesToRun(cases, ['CE-05']);
    expect(selected.map((c) => c.id).sort()).toEqual(['a', 'safety']);
  });

  it('an unaffected, non-safety case is excluded', () => {
    const cases = [ordinaryCase('a', 'CE-05'), ordinaryCase('b', 'CE-06')];
    const selected = selectCasesToRun(cases, []);
    expect(selected).toEqual([]);
  });
});
