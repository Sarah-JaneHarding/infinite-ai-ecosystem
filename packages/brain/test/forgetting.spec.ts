import type { RetentionSchedule } from '@infinite-ai/contracts';
import { describe, expect, it } from 'vitest';

import { decideBrainRetention, type RetainableBrainFact } from '../src/forgetting.js';

const NOW = new Date('2027-01-01T00:00:00.000Z');

const RATIFIED_SCHEDULE: RetentionSchedule = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  rules: [
    {
      category: 'ATTENDANCE',
      anchor: 'ACADEMIC_YEAR_END',
      retainMonths: 12,
      authority: 'National Archives and Records Service Act, schedule 3',
      ratifiedAt: new Date('2026-01-01T00:00:00.000Z'),
      ratifiedBy: 'a-governing-body',
    },
  ],
};

function fact(overrides: Partial<RetainableBrainFact> = {}): RetainableBrainFact {
  return {
    id: 'fact-1',
    targetTier: 'L1_NODE',
    subjectToken: 'LNR_ABC123',
    category: 'ATTENDANCE',
    anchor: 'ACADEMIC_YEAR_END',
    anchoredAt: new Date('2025-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('decideBrainRetention', () => {
  it('tombstones a fact whose ratified period has elapsed', () => {
    const decisions = decideBrainRetention(RATIFIED_SCHEDULE, [fact()], NOW);
    expect(decisions).toEqual([{ fact: fact(), action: 'tombstone' }]);
  });

  it('retains a fact still within its ratified period', () => {
    const recent = fact({ anchoredAt: new Date('2026-12-01T00:00:00.000Z') });
    const decisions = decideBrainRetention(RATIFIED_SCHEDULE, [recent], NOW);
    expect(decisions).toEqual([
      { fact: recent, action: 'retain', reason: 'within_period' },
    ]);
  });

  it('retains a fact whose category has no ratified rule — unscheduled, not destroyed', () => {
    const unscheduled = fact({ category: 'BEHAVIOUR' });
    const decisions = decideBrainRetention(RATIFIED_SCHEDULE, [unscheduled], NOW);
    expect(decisions).toEqual([
      { fact: unscheduled, action: 'retain', reason: 'no_rule' },
    ]);
  });

  it('retains a fact whose anchor has not been reached yet', () => {
    const notYet = fact({ anchoredAt: null });
    const decisions = decideBrainRetention(RATIFIED_SCHEDULE, [notYet], NOW);
    expect(decisions).toEqual([
      { fact: notYet, action: 'retain', reason: 'anchor_not_reached' },
    ]);
  });

  it('retains a fact anchored differently from the ratified rule', () => {
    const mismatched = fact({ anchor: 'SUBJECT_EXIT' });
    const decisions = decideBrainRetention(RATIFIED_SCHEDULE, [mismatched], NOW);
    expect(decisions).toEqual([
      { fact: mismatched, action: 'retain', reason: 'anchor_mismatch' },
    ]);
  });

  it('decides each fact in a mixed batch independently', () => {
    const expired = fact({ id: 'expired' });
    const current = fact({ id: 'current', anchoredAt: new Date('2026-12-01') });
    const decisions = decideBrainRetention(RATIFIED_SCHEDULE, [expired, current], NOW);
    expect(decisions.map((d) => d.action)).toEqual(['tombstone', 'retain']);
  });

  it('handles an empty fact list', () => {
    expect(decideBrainRetention(RATIFIED_SCHEDULE, [], NOW)).toEqual([]);
  });
});
