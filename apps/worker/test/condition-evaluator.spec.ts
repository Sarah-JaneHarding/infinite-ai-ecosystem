// Unit tests for the real branch-condition evaluator (OQ-024) — the five condition
// strings declared across mod-02.ts/mod-05.ts/le.ts, each checked against exactly the
// `ConditionInput` shape `packages/orchestrator/src/runner.ts`'s `resolveConditionInput`
// actually builds.

import type { ConditionInput } from '@infinite-ai/orchestrator';
import { describe, expect, it } from 'vitest';

import {
  UnresolvedConditionError,
  evaluateCondition,
} from '../src/condition-evaluator.js';

function input(stepOutput: unknown, runInput: unknown = {}): ConditionInput {
  return { runInput, stepOutput };
}

describe('evaluateCondition', () => {
  it('support.core_health_blocked: true only when AC-02’s output.status is "blocked"', () => {
    expect(
      evaluateCondition('support.core_health_blocked', input({ status: 'blocked' })),
    ).toBe(true);
    expect(
      evaluateCondition('support.core_health_blocked', input({ status: 'healthy' })),
    ).toBe(false);
  });

  it('pd.is_suppressed: true only when PD-04’s output.status is "suppressed"', () => {
    expect(evaluateCondition('pd.is_suppressed', input({ status: 'suppressed' }))).toBe(
      true,
    );
    expect(evaluateCondition('pd.is_suppressed', input({ status: 'ok' }))).toBe(false);
  });

  it('pd.needs_micro_course: true only when the top priority gap suggests micro_course', () => {
    expect(
      evaluateCondition(
        'pd.needs_micro_course',
        input({
          status: 'ok',
          topPriorityGap: { suggestedInterventionType: 'micro_course' },
        }),
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        'pd.needs_micro_course',
        input({
          status: 'ok',
          topPriorityGap: { suggestedInterventionType: 'coaching_cycle' },
        }),
      ),
    ).toBe(false);
    // needs_input has no topPriorityGap at all — reads as false, not a crash.
    expect(
      evaluateCondition('pd.needs_micro_course', input({ status: 'needs_input' })),
    ).toBe(false);
  });

  it('learning.commons_publish_blocked: true for every status except "published"', () => {
    expect(
      evaluateCondition(
        'learning.commons_publish_blocked',
        input({ status: 'published' }),
      ),
    ).toBe(false);
    for (const status of [
      'suppressed_below_threshold',
      'suppressed_no_opt_in',
      'needs_input',
    ]) {
      expect(
        evaluateCondition('learning.commons_publish_blocked', input({ status })),
      ).toBe(true);
    }
  });

  it('support.needs_referral: throws rather than guessing an unratified field shape (OQ-027)', () => {
    expect(() =>
      evaluateCondition('support.needs_referral', input([{ flagged: true }])),
    ).toThrow(UnresolvedConditionError);
  });

  it('throws for a condition string with no registered evaluator', () => {
    expect(() => evaluateCondition('mod-99.unknown_condition', input({}))).toThrow(
      UnresolvedConditionError,
    );
  });
});
