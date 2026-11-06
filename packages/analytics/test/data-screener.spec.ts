// AC-11 Analytics Data Screener rules — Stage 10 step 6.
//
// The rules are pure, so every branch is checked directly: fixed check order
// (staleness → coverage → suppression → ready), the school-set staleness threshold,
// distinct-domain counting, and that every result conforms to `AC11Result`.

import { describe, expect, it } from 'vitest';

import { AC11Input, AC11Result } from '../src/agent-schemas.js';
import { screenRollup } from '../src/data-screener.js';

const SCREEN_ID = '99999999-0000-0000-0000-000000000001';

function input(overrides: Partial<AC11Input> = {}): AC11Input {
  return {
    tenantId: '00000000-0000-0000-0000-000000000001',
    reportScope: 'class',
    scopeId: '11111111-0000-0000-0000-000000000001',
    termId: '00000000-0000-0000-0000-000000000020',
    learnerCount: 28,
    coveredDomains: ['LITERACY', 'NUMERACY', 'ATTENDANCE'],
    mostRecentDataAgeInDays: 10,
    staleAfterDays: 45,
    hasSuppressionFlag: false,
    evidenceIds: ['ev-001', 'ev-002'],
    ...overrides,
  };
}

describe('screenRollup — ready', () => {
  it('returns ready with the distinct domain count and the evidence ids unchanged', () => {
    const r = screenRollup(input(), SCREEN_ID);
    expect(r).toEqual({
      status: 'ready',
      screenId: SCREEN_ID,
      reportScope: 'class',
      scopeId: '11111111-0000-0000-0000-000000000001',
      termId: '00000000-0000-0000-0000-000000000020',
      learnerCount: 28,
      coveredDomainCount: 3,
      evidenceIds: ['ev-001', 'ev-002'],
    });
  });

  it('accepts exactly the minimum cohort (5 learners)', () => {
    expect(screenRollup(input({ learnerCount: 5 }), SCREEN_ID).status).toBe('ready');
  });

  it('accepts data exactly as old as the threshold', () => {
    expect(
      screenRollup(input({ mostRecentDataAgeInDays: 45, staleAfterDays: 45 }), SCREEN_ID)
        .status,
    ).toBe('ready');
  });

  it('counts a domain listed twice once', () => {
    const r = screenRollup(
      input({ coveredDomains: ['LITERACY', 'LITERACY', 'NUMERACY'] }),
      SCREEN_ID,
    );
    expect(r).toMatchObject({ status: 'ready', coveredDomainCount: 2 });
  });
});

describe('screenRollup — the staleness threshold belongs to the school', () => {
  it('the same data age is stale for one school and fresh for another', () => {
    const strict = screenRollup(
      input({ mostRecentDataAgeInDays: 50, staleAfterDays: 30 }),
      SCREEN_ID,
    );
    const relaxed = screenRollup(
      input({ mostRecentDataAgeInDays: 50, staleAfterDays: 60 }),
      SCREEN_ID,
    );
    expect(strict).toEqual({ status: 'needs_input', detail: 'DATA_STALE' });
    expect(relaxed.status).toBe('ready');
  });

  it('one day past the threshold is stale', () => {
    expect(
      screenRollup(input({ mostRecentDataAgeInDays: 46, staleAfterDays: 45 }), SCREEN_ID),
    ).toEqual({
      status: 'needs_input',
      detail: 'DATA_STALE',
    });
  });

  it('the schema rejects an input with no threshold — there is no platform default', () => {
    const { staleAfterDays: _omitted, ...rest } = input();
    expect(AC11Input.safeParse(rest).success).toBe(false);
  });

  it('the schema rejects a threshold below 1 day', () => {
    expect(AC11Input.safeParse(input({ staleAfterDays: 0 })).success).toBe(false);
  });
});

describe('screenRollup — suppression', () => {
  it('4 learners is suppressed as cohort_too_small', () => {
    expect(screenRollup(input({ learnerCount: 4 }), SCREEN_ID)).toMatchObject({
      status: 'suppressed',
      suppressionReason: 'cohort_too_small',
      learnerCount: 4,
    });
  });

  it('0 learners is suppressed as cohort_too_small', () => {
    expect(screenRollup(input({ learnerCount: 0 }), SCREEN_ID)).toMatchObject({
      status: 'suppressed',
      suppressionReason: 'cohort_too_small',
    });
  });

  it('a sub-bucket flag on a large cohort is suppressed as sub_bucket_suppressed', () => {
    expect(
      screenRollup(input({ learnerCount: 30, hasSuppressionFlag: true }), SCREEN_ID),
    ).toMatchObject({
      status: 'suppressed',
      suppressionReason: 'sub_bucket_suppressed',
    });
  });

  it('both conditions at once report cohort_too_small', () => {
    expect(
      screenRollup(input({ learnerCount: 3, hasSuppressionFlag: true }), SCREEN_ID),
    ).toMatchObject({
      suppressionReason: 'cohort_too_small',
    });
  });

  it('passes the evidence ids through when suppressed', () => {
    const r = screenRollup(
      input({ learnerCount: 3, evidenceIds: ['ev-a', 'ev-b'] }),
      SCREEN_ID,
    );
    expect(r).toMatchObject({ status: 'suppressed', evidenceIds: ['ev-a', 'ev-b'] });
  });
});

describe('screenRollup — fixed check order: staleness, coverage, suppression', () => {
  it('stale and no domains reports DATA_STALE', () => {
    expect(
      screenRollup(input({ mostRecentDataAgeInDays: 60, coveredDomains: [] }), SCREEN_ID),
    ).toEqual({
      status: 'needs_input',
      detail: 'DATA_STALE',
    });
  });

  it('stale and a small cohort reports DATA_STALE', () => {
    expect(
      screenRollup(input({ mostRecentDataAgeInDays: 60, learnerCount: 2 }), SCREEN_ID),
    ).toEqual({
      status: 'needs_input',
      detail: 'DATA_STALE',
    });
  });

  it('a large but stale cohort reports DATA_STALE', () => {
    expect(
      screenRollup(input({ learnerCount: 500, mostRecentDataAgeInDays: 90 }), SCREEN_ID),
    ).toEqual({ status: 'needs_input', detail: 'DATA_STALE' });
  });

  it('no domains and a small cohort reports NO_DOMAIN_DATA', () => {
    expect(
      screenRollup(input({ coveredDomains: [], learnerCount: 2 }), SCREEN_ID),
    ).toEqual({
      status: 'needs_input',
      detail: 'NO_DOMAIN_DATA',
    });
  });
});

describe('screenRollup — every result conforms to AC11Result', () => {
  const cases: Array<[string, Partial<AC11Input>]> = [
    ['ready', {}],
    ['suppressed (cohort)', { learnerCount: 2 }],
    ['suppressed (sub-bucket)', { hasSuppressionFlag: true }],
    ['needs_input (stale)', { mostRecentDataAgeInDays: 99 }],
    ['needs_input (no domains)', { coveredDomains: [] }],
  ];
  for (const [name, overrides] of cases) {
    it(name, () => {
      expect(
        AC11Result.safeParse(screenRollup(input(overrides), SCREEN_ID)).success,
      ).toBe(true);
    });
  }

  it('never echoes the tenant id', () => {
    const r = screenRollup(input(), SCREEN_ID);
    expect(JSON.stringify(r)).not.toContain('00000000-0000-0000-0000-000000000001');
  });
});
