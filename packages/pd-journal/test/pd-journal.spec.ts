import { describe, expect, it } from 'vitest';

import { checkPdPoints } from '@infinite-ai/compliance';

import { buildPdCycleSummary, computeCycleProgress } from '../src/journal.js';
import { PdJournalEntry } from '../src/types.js';
import type { PdJournalEntry as PdJournalEntryType } from '../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CYCLE_START = '2024-01-01';
const YEAR_1_DATE = '2024-06-15';
const YEAR_2_DATE = '2025-06-15';
const YEAR_3_DATE = '2026-06-15';

function makeEntry(
  overrides: Partial<PdJournalEntryType> & { educatorToken?: string },
): PdJournalEntryType {
  return {
    entryToken: 'e-001',
    educatorToken: 'edu-001',
    activityType: 'TYPE_1_TEACHER_INITIATED',
    activityDate: YEAR_1_DATE,
    description: 'Attended curriculum workshop',
    claimedPoints: 10,
    pointsStatus: 'VERIFIED',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// PdJournalEntry schema validation
// ---------------------------------------------------------------------------

describe('PdJournalEntry schema', () => {
  it('accepts a valid entry', () => {
    const result = PdJournalEntry.safeParse(makeEntry({}));
    expect(result.success).toBe(true);
  });

  it('rejects a missing educatorToken', () => {
    const result = PdJournalEntry.safeParse(makeEntry({ educatorToken: '' }));
    expect(result.success).toBe(false);
  });

  it('rejects an invalid activityDate format', () => {
    const result = PdJournalEntry.safeParse(makeEntry({ activityDate: '15-06-2024' }));
    expect(result.success).toBe(false);
  });

  it('rejects a negative claimedPoints', () => {
    const result = PdJournalEntry.safeParse(makeEntry({ claimedPoints: -1 }));
    expect(result.success).toBe(false);
  });

  it('rejects an unknown pointsStatus', () => {
    const result = PdJournalEntry.safeParse(
      makeEntry({ pointsStatus: 'APPROVED' as 'VERIFIED' }),
    );
    expect(result.success).toBe(false);
  });

  it('accepts claimedPoints = 0', () => {
    const result = PdJournalEntry.safeParse(makeEntry({ claimedPoints: 0 }));
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeCycleProgress — empty journal
// ---------------------------------------------------------------------------

describe('computeCycleProgress — empty journal', () => {
  it('returns zero points and cycleYear 1 when there are no entries', () => {
    const progress = computeCycleProgress([], CYCLE_START, YEAR_1_DATE);
    expect(progress.verifiedPoints).toBe(0);
    expect(progress.pendingPoints).toBe(0);
    expect(progress.totalClaimedPoints).toBe(0);
    expect(progress.cycleYear).toBe(1);
  });

  it('reports cycleYear 2 for an empty journal when asOf is in year 2', () => {
    const progress = computeCycleProgress([], CYCLE_START, YEAR_2_DATE);
    expect(progress.cycleYear).toBe(2);
  });

  it('reports cycleYear 3 for an empty journal when asOf is in year 3', () => {
    const progress = computeCycleProgress([], CYCLE_START, YEAR_3_DATE);
    expect(progress.cycleYear).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// computeCycleProgress — point accumulation
// ---------------------------------------------------------------------------

describe('computeCycleProgress — point accumulation', () => {
  it('sums verified points from all in-cycle VERIFIED entries', () => {
    const entries = [
      makeEntry({ claimedPoints: 20, activityDate: YEAR_1_DATE }),
      makeEntry({ entryToken: 'e-002', claimedPoints: 30, activityDate: YEAR_2_DATE }),
    ];
    const progress = computeCycleProgress(entries, CYCLE_START, YEAR_3_DATE);
    expect(progress.verifiedPoints).toBe(50);
    expect(progress.pendingPoints).toBe(0);
    expect(progress.totalClaimedPoints).toBe(50);
  });

  it('counts PENDING_VERIFICATION points as pending, not verified', () => {
    const entries = [
      makeEntry({ claimedPoints: 10, pointsStatus: 'VERIFIED' }),
      makeEntry({
        entryToken: 'e-002',
        claimedPoints: 15,
        pointsStatus: 'PENDING_VERIFICATION',
      }),
    ];
    const progress = computeCycleProgress(entries, CYCLE_START, YEAR_2_DATE);
    expect(progress.verifiedPoints).toBe(10);
    expect(progress.pendingPoints).toBe(15);
    expect(progress.totalClaimedPoints).toBe(25);
  });

  it('excludes REJECTED entries from all totals', () => {
    const entries = [
      makeEntry({ claimedPoints: 40, pointsStatus: 'VERIFIED' }),
      makeEntry({ entryToken: 'e-002', claimedPoints: 999, pointsStatus: 'REJECTED' }),
    ];
    const progress = computeCycleProgress(entries, CYCLE_START, YEAR_2_DATE);
    expect(progress.verifiedPoints).toBe(40);
    expect(progress.pendingPoints).toBe(0);
    expect(progress.totalClaimedPoints).toBe(40);
  });

  it('excludes entries whose activityDate is before the cycle start', () => {
    const entries = [
      makeEntry({ claimedPoints: 100, activityDate: '2023-12-31' }), // before CYCLE_START
      makeEntry({ entryToken: 'e-002', claimedPoints: 20, activityDate: YEAR_1_DATE }),
    ];
    const progress = computeCycleProgress(entries, CYCLE_START, YEAR_2_DATE);
    expect(progress.verifiedPoints).toBe(20);
  });

  it('excludes entries whose activityDate is after asOf', () => {
    const entries = [
      makeEntry({ claimedPoints: 20, activityDate: YEAR_1_DATE }),
      makeEntry({ entryToken: 'e-002', claimedPoints: 100, activityDate: '2027-01-01' }),
    ];
    const progress = computeCycleProgress(entries, CYCLE_START, YEAR_2_DATE);
    expect(progress.verifiedPoints).toBe(20);
  });

  it('includes an entry exactly on cycleStartDate', () => {
    const entries = [makeEntry({ claimedPoints: 5, activityDate: CYCLE_START })];
    const progress = computeCycleProgress(entries, CYCLE_START, YEAR_1_DATE);
    expect(progress.verifiedPoints).toBe(5);
  });

  it('includes an entry exactly on asOf', () => {
    const entries = [makeEntry({ claimedPoints: 5, activityDate: YEAR_2_DATE })];
    const progress = computeCycleProgress(entries, CYCLE_START, YEAR_2_DATE);
    expect(progress.verifiedPoints).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// computeCycleProgress — type breakdown
// ---------------------------------------------------------------------------

describe('computeCycleProgress — type breakdown', () => {
  it('attributes points to the correct activity type in the breakdown', () => {
    const entries = [
      makeEntry({
        activityType: 'TYPE_1_TEACHER_INITIATED',
        claimedPoints: 10,
        pointsStatus: 'VERIFIED',
      }),
      makeEntry({
        entryToken: 'e-002',
        activityType: 'TYPE_2_SCHOOL_INITIATED',
        claimedPoints: 20,
        pointsStatus: 'VERIFIED',
      }),
      makeEntry({
        entryToken: 'e-003',
        activityType: 'TYPE_3_EXTERNALLY_INITIATED',
        claimedPoints: 30,
        pointsStatus: 'PENDING_VERIFICATION',
      }),
    ];
    const progress = computeCycleProgress(entries, CYCLE_START, YEAR_2_DATE);
    expect(progress.breakdownByType.TYPE_1_TEACHER_INITIATED).toEqual({
      verified: 10,
      pending: 0,
    });
    expect(progress.breakdownByType.TYPE_2_SCHOOL_INITIATED).toEqual({
      verified: 20,
      pending: 0,
    });
    expect(progress.breakdownByType.TYPE_3_EXTERNALLY_INITIATED).toEqual({
      verified: 0,
      pending: 30,
    });
  });

  it('initialises all type slots to zero when no entries qualify', () => {
    const progress = computeCycleProgress([], CYCLE_START, YEAR_1_DATE);
    for (const slot of Object.values(progress.breakdownByType)) {
      expect(slot).toEqual({ verified: 0, pending: 0 });
    }
  });

  it('accumulates both verified and pending into the same type slot independently', () => {
    const entries = [
      makeEntry({
        activityType: 'TYPE_2_SCHOOL_INITIATED',
        claimedPoints: 5,
        pointsStatus: 'VERIFIED',
      }),
      makeEntry({
        entryToken: 'e-002',
        activityType: 'TYPE_2_SCHOOL_INITIATED',
        claimedPoints: 3,
        pointsStatus: 'PENDING_VERIFICATION',
      }),
    ];
    const progress = computeCycleProgress(entries, CYCLE_START, YEAR_2_DATE);
    expect(progress.breakdownByType.TYPE_2_SCHOOL_INITIATED).toEqual({
      verified: 5,
      pending: 3,
    });
    expect(progress.breakdownByType.TYPE_1_TEACHER_INITIATED).toEqual({
      verified: 0,
      pending: 0,
    });
  });

  it('rejected entries do not appear in the type breakdown', () => {
    const entries = [
      makeEntry({
        activityType: 'TYPE_3_EXTERNALLY_INITIATED',
        claimedPoints: 50,
        pointsStatus: 'REJECTED',
      }),
    ];
    const progress = computeCycleProgress(entries, CYCLE_START, YEAR_1_DATE);
    expect(progress.breakdownByType.TYPE_3_EXTERNALLY_INITIATED).toEqual({
      verified: 0,
      pending: 0,
    });
  });

  it('handles all three statuses for the same type correctly', () => {
    const entries = [
      makeEntry({ claimedPoints: 10, pointsStatus: 'VERIFIED' }),
      makeEntry({
        entryToken: 'e-002',
        claimedPoints: 5,
        pointsStatus: 'PENDING_VERIFICATION',
      }),
      makeEntry({ entryToken: 'e-003', claimedPoints: 999, pointsStatus: 'REJECTED' }),
    ];
    const progress = computeCycleProgress(entries, CYCLE_START, YEAR_1_DATE);
    expect(progress.breakdownByType.TYPE_1_TEACHER_INITIATED).toEqual({
      verified: 10,
      pending: 5,
    });
    expect(progress.verifiedPoints).toBe(10);
    expect(progress.pendingPoints).toBe(5);
    expect(progress.totalClaimedPoints).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// buildPdCycleSummary
// ---------------------------------------------------------------------------

describe('buildPdCycleSummary', () => {
  it('produces a single educator entry with verified points as pdPointsAccumulated', () => {
    const journal = new Map([
      [
        'edu-001',
        {
          entries: [makeEntry({ claimedPoints: 80, pointsStatus: 'VERIFIED' })],
          cycleStartDate: CYCLE_START,
        },
      ],
    ]);
    const summary = buildPdCycleSummary(journal, 'tenant-a', YEAR_3_DATE);
    expect(summary.tenantId).toBe('tenant-a');
    expect(summary.educators).toHaveLength(1);
    expect(summary.educators[0]).toEqual({
      educatorToken: 'edu-001',
      pdPointsAccumulated: 80,
      cycleYear: 3,
    });
  });

  it('excludes PENDING points from pdPointsAccumulated', () => {
    const journal = new Map([
      [
        'edu-002',
        {
          entries: [
            makeEntry({ claimedPoints: 50, pointsStatus: 'VERIFIED' }),
            makeEntry({
              entryToken: 'e-002',
              claimedPoints: 40,
              pointsStatus: 'PENDING_VERIFICATION',
            }),
          ],
          cycleStartDate: CYCLE_START,
        },
      ],
    ]);
    const summary = buildPdCycleSummary(journal, 'tenant-a', YEAR_2_DATE);
    expect(summary.educators[0]?.pdPointsAccumulated).toBe(50);
  });

  it('handles multiple educators independently', () => {
    const journal = new Map([
      [
        'edu-A',
        { entries: [makeEntry({ claimedPoints: 120 })], cycleStartDate: CYCLE_START },
      ],
      [
        'edu-B',
        {
          entries: [
            makeEntry({ claimedPoints: 30, pointsStatus: 'PENDING_VERIFICATION' }),
          ],
          cycleStartDate: CYCLE_START,
        },
      ],
    ]);
    const summary = buildPdCycleSummary(journal, 'tenant-b', YEAR_3_DATE);
    expect(summary.educators).toHaveLength(2);
    const a = summary.educators.find((e) => e.educatorToken === 'edu-A');
    const b = summary.educators.find((e) => e.educatorToken === 'edu-B');
    expect(a?.pdPointsAccumulated).toBe(120);
    expect(b?.pdPointsAccumulated).toBe(0); // pending, not verified
  });

  it('returns zero pdPointsAccumulated for an educator with no entries', () => {
    const journal = new Map([
      ['edu-empty', { entries: [], cycleStartDate: CYCLE_START }],
    ]);
    const summary = buildPdCycleSummary(journal, 'tenant-a', YEAR_2_DATE);
    expect(summary.educators[0]?.pdPointsAccumulated).toBe(0);
  });

  it('returns an empty educators array when the journal is empty', () => {
    const summary = buildPdCycleSummary(new Map(), 'tenant-a', YEAR_1_DATE);
    expect(summary.educators).toHaveLength(0);
  });

  it('preserves the tenantId in the summary', () => {
    const journal = new Map([['edu-001', { entries: [], cycleStartDate: CYCLE_START }]]);
    const summary = buildPdCycleSummary(journal, 'tenant-xyz', YEAR_1_DATE);
    expect(summary.tenantId).toBe('tenant-xyz');
  });

  it('returns cycleYear for each educator based on their own cycle start date', () => {
    const journal = new Map([
      ['edu-yr1', { entries: [], cycleStartDate: '2026-01-01' }],
      ['edu-yr3', { entries: [], cycleStartDate: '2024-01-01' }],
    ]);
    const summary = buildPdCycleSummary(journal, 'tenant-a', '2026-06-15');
    const yr1 = summary.educators.find((e) => e.educatorToken === 'edu-yr1');
    const yr3 = summary.educators.find((e) => e.educatorToken === 'edu-yr3');
    expect(yr1?.cycleYear).toBe(1);
    expect(yr3?.cycleYear).toBe(3);
  });

  it('educators with different cycle start dates are each computed from their own start', () => {
    const journal = new Map([
      [
        'edu-early',
        {
          entries: [makeEntry({ claimedPoints: 20, activityDate: '2022-06-01' })],
          cycleStartDate: '2022-01-01',
        },
      ],
      [
        'edu-late',
        {
          entries: [makeEntry({ claimedPoints: 20, activityDate: '2022-06-01' })],
          cycleStartDate: '2025-01-01',
        },
      ],
    ]);
    const asOf = '2026-06-15';
    const summary = buildPdCycleSummary(journal, 'tenant-a', asOf);
    const early = summary.educators.find((e) => e.educatorToken === 'edu-early');
    const late = summary.educators.find((e) => e.educatorToken === 'edu-late');
    // edu-early: activity at 2022-06-01 is in their cycle (start 2022-01-01); verified = 20
    expect(early?.pdPointsAccumulated).toBe(20);
    // edu-late: activity at 2022-06-01 is BEFORE their cycle (start 2025-01-01); excluded = 0
    expect(late?.pdPointsAccumulated).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Integration with checkPdPoints (compliance engine)
// ---------------------------------------------------------------------------

describe('integration with checkPdPoints', () => {
  it('produces no findings when a year-1 educator has zero verified points', () => {
    // No minimum exists in year 1 — no findings expected.
    const journal = new Map([['edu-001', { entries: [], cycleStartDate: CYCLE_START }]]);
    const summary = buildPdCycleSummary(journal, 'tenant-a', YEAR_1_DATE);
    const findings = checkPdPoints(summary);
    expect(findings).toHaveLength(0);
  });

  it('produces no findings when an educator has 150 verified points in year 3', () => {
    const journal = new Map([
      [
        'edu-001',
        {
          entries: [makeEntry({ claimedPoints: 150, activityDate: YEAR_2_DATE })],
          cycleStartDate: CYCLE_START,
        },
      ],
    ]);
    const summary = buildPdCycleSummary(journal, 'tenant-a', YEAR_3_DATE);
    const findings = checkPdPoints(summary);
    expect(findings).toHaveLength(0);
  });

  it('produces a VIOLATION when verified points fall short at end of cycle', () => {
    const journal = new Map([
      [
        'edu-001',
        {
          entries: [makeEntry({ claimedPoints: 80 })],
          cycleStartDate: CYCLE_START,
        },
      ],
    ]);
    const summary = buildPdCycleSummary(journal, 'tenant-a', YEAR_3_DATE);
    const findings = checkPdPoints(summary);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('VIOLATION');
    expect(findings[0]?.code).toBe('PD_POINTS_SHORTFALL_END_OF_CYCLE');
  });

  it('produces an INFO finding when year-2 points are below the advisory midpoint', () => {
    const journal = new Map([
      [
        'edu-001',
        {
          entries: [makeEntry({ claimedPoints: 20 })],
          cycleStartDate: CYCLE_START,
        },
      ],
    ]);
    const summary = buildPdCycleSummary(journal, 'tenant-a', YEAR_2_DATE);
    const findings = checkPdPoints(summary);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('INFO');
  });

  it('produces no findings when an educator has exactly 150 verified points in year 3', () => {
    // Boundary: exactly at the requirement threshold must not produce a VIOLATION.
    const journal = new Map([
      [
        'edu-exact',
        {
          entries: [
            makeEntry({ claimedPoints: 100, activityDate: YEAR_1_DATE }),
            makeEntry({
              entryToken: 'e-002',
              claimedPoints: 50,
              activityDate: YEAR_2_DATE,
            }),
          ],
          cycleStartDate: CYCLE_START,
        },
      ],
    ]);
    const summary = buildPdCycleSummary(journal, 'tenant-a', YEAR_3_DATE);
    const findings = checkPdPoints(summary);
    expect(findings).toHaveLength(0);
  });

  it('only counts verified points for compliance — pending points do not satisfy the requirement', () => {
    // Educator has 150 claimed but only 80 verified; should still produce a VIOLATION.
    const journal = new Map([
      [
        'edu-001',
        {
          entries: [
            makeEntry({ claimedPoints: 80, pointsStatus: 'VERIFIED' }),
            makeEntry({
              entryToken: 'e-002',
              claimedPoints: 70,
              pointsStatus: 'PENDING_VERIFICATION',
            }),
          ],
          cycleStartDate: CYCLE_START,
        },
      ],
    ]);
    const summary = buildPdCycleSummary(journal, 'tenant-a', YEAR_3_DATE);
    const findings = checkPdPoints(summary);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('VIOLATION');
  });
});
