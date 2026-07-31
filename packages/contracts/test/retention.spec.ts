// The retention schedule. The destructive branch is reachable by exactly one path, and
// most of these tests are about the paths that must not reach it.

import { describe, expect, it } from 'vitest';

import { DataCategory } from '../src/popia/purpose.js';
import {
  RetentionRule,
  RetentionSchedule,
  addMonths,
  evaluateRetention,
  ruleFor,
  unscheduledCategories,
  type RetainableRecord,
} from '../src/popia/retention.js';

const TENANT = '11111111-1111-4111-8111-111111111111';

function rule(overrides: Partial<RetentionRule> = {}): RetentionRule {
  return {
    category: 'ATTENDANCE',
    anchor: 'ACADEMIC_YEAR_END',
    retainMonths: 60,
    authority: 'Governing body resolution 2026/04, minuted 2026-04-18',
    ratifiedAt: new Date('2026-04-18T00:00:00.000Z'),
    ratifiedBy: 'Kleinbos Primary SGB',
    ...overrides,
  };
}

function schedule(rules: RetentionRule[]): RetentionSchedule {
  return { tenantId: TENANT, rules };
}

function record(overrides: Partial<RetainableRecord> = {}): RetainableRecord {
  return {
    subjectToken: 'LNR_7F3A2C0B91DE',
    category: 'ATTENDANCE',
    anchor: 'ACADEMIC_YEAR_END',
    anchoredAt: new Date('2020-12-31T00:00:00.000Z'),
    ...overrides,
  };
}

describe('this file ships no retention periods', () => {
  it('exports no schedule, default or example', () => {
    // The point of the module, asserted rather than trusted to a comment. A period is a
    // legal determination each school makes and ratifies; a plausible default here would
    // be wrong in a way nobody checks and would destroy records on a schedule no human
    // agreed to. See OQ-007.
    const empty = schedule([]);
    expect(empty.rules).toEqual([]);
    expect(unscheduledCategories(empty)).toEqual(DataCategory.options);
  });

  it('leaves every category unscheduled until someone ratifies one', () => {
    const partial = schedule([rule()]);
    expect(unscheduledCategories(partial)).not.toContain('ATTENDANCE');
    expect(unscheduledCategories(partial)).toContain('SPECIAL_PERSONAL');
  });
});

describe('what a rule must carry', () => {
  it('refuses a rule with no authority behind it', () => {
    // A period nobody can source is a period that will be withdrawn under pressure at
    // precisely the wrong moment.
    expect(RetentionRule.safeParse({ ...rule(), authority: '' }).success).toBe(false);
    expect(RetentionRule.safeParse({ ...rule(), authority: 'because' }).success).toBe(
      false,
    );
  });

  it('refuses a zero or negative period', () => {
    expect(RetentionRule.safeParse({ ...rule(), retainMonths: 0 }).success).toBe(false);
    expect(RetentionRule.safeParse({ ...rule(), retainMonths: -12 }).success).toBe(false);
  });

  it('refuses a fractional period', () => {
    expect(RetentionRule.safeParse({ ...rule(), retainMonths: 60.5 }).success).toBe(
      false,
    );
  });

  it('refuses two rules for one category', () => {
    const result = RetentionSchedule.safeParse(
      schedule([rule(), rule({ retainMonths: 12 })]),
    );
    expect(result.success).toBe(false);
  });

  it('has no catch-all rule to refuse', () => {
    // A default would let a school ratify one number and have it silently govern
    // categories nobody considered — which is how special personal information ends up on
    // the same clock as a class list.
    expect(Object.keys(RetentionSchedule.shape).sort()).toEqual(['rules', 'tenantId']);
  });
});

describe('month arithmetic', () => {
  it('clamps to the end of a shorter month', () => {
    // 31 January plus one month is 28 February, not 3 March. A record that expires three
    // days early is a record destroyed three days before anyone agreed it could be.
    expect(addMonths(new Date('2026-01-31T00:00:00.000Z'), 1).toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
  });

  it('handles a leap year', () => {
    expect(addMonths(new Date('2028-01-31T00:00:00.000Z'), 1).toISOString()).toBe(
      '2028-02-29T00:00:00.000Z',
    );
  });

  it('crosses year boundaries', () => {
    expect(addMonths(new Date('2020-12-31T00:00:00.000Z'), 60).toISOString()).toBe(
      '2025-12-31T00:00:00.000Z',
    );
  });

  it('preserves the time of day', () => {
    expect(addMonths(new Date('2026-03-15T14:30:45.123Z'), 3).toISOString()).toBe(
      '2026-06-15T14:30:45.123Z',
    );
  });
});

describe('every uncertainty lands on retain', () => {
  it('retains a category with no ratified rule, however old', () => {
    const verdict = evaluateRetention(
      schedule([]),
      record({ anchoredAt: new Date('1999-01-01T00:00:00.000Z') }),
      new Date('2026-06-01T00:00:00.000Z'),
    );
    expect(verdict.action).toBe('retain');
    expect(verdict.action === 'retain' && verdict.reason).toBe('no_rule');
  });

  it('retains when the rule was ratified against a different anchor', () => {
    // "Five years from the learner leaving" is not "five years from the year ending", and
    // applying one period to the other clock destroys data the governing body did not
    // agree to destroy.
    const verdict = evaluateRetention(
      schedule([rule({ anchor: 'SUBJECT_EXIT' })]),
      record({ anchor: 'ACADEMIC_YEAR_END' }),
      new Date('2030-06-01T00:00:00.000Z'),
    );
    expect(verdict.action).toBe('retain');
    expect(verdict.action === 'retain' && verdict.reason).toBe('anchor_mismatch');
  });

  it('retains when the anchor has not happened yet', () => {
    const verdict = evaluateRetention(
      schedule([rule({ anchor: 'SUBJECT_EXIT' })]),
      record({ anchor: 'SUBJECT_EXIT', anchoredAt: null }),
      new Date('2030-06-01T00:00:00.000Z'),
    );
    expect(verdict.action === 'retain' && verdict.reason).toBe('anchor_not_reached');
  });

  it('retains inside the period, and says when it ends', () => {
    const verdict = evaluateRetention(
      schedule([rule()]),
      record(),
      new Date('2024-06-01T00:00:00.000Z'),
    );
    expect(verdict.action).toBe('retain');
    expect(
      verdict.action === 'retain' && verdict.reason === 'within_period'
        ? verdict.expiresAt.toISOString()
        : null,
    ).toBe('2025-12-31T00:00:00.000Z');
  });

  it('retains through the whole of the final day', () => {
    // Strictly after, not on-or-after. Off by one here is a day of records destroyed
    // early, every night, silently.
    const expiry = new Date('2025-12-31T00:00:00.000Z');
    expect(evaluateRetention(schedule([rule()]), record(), expiry).action).toBe('retain');
  });
});

describe('the one path that destroys', () => {
  it('tombstones a record whose ratified period has elapsed', () => {
    const verdict = evaluateRetention(
      schedule([rule()]),
      record(),
      new Date('2026-01-01T00:00:00.000Z'),
    );
    expect(verdict.action).toBe('tombstone');
    expect(verdict.action === 'tombstone' && verdict.expiredAt.toISOString()).toBe(
      '2025-12-31T00:00:00.000Z',
    );
  });
});

describe('looking a rule up', () => {
  it('finds the rule for a category', () => {
    expect(ruleFor(schedule([rule()]), 'ATTENDANCE')?.retainMonths).toBe(60);
  });

  it('returns undefined rather than a permissive default', () => {
    expect(ruleFor(schedule([rule()]), 'SPECIAL_PERSONAL')).toBeUndefined();
  });
});
