import { SACE_CPTD_CYCLE_YEARS } from '@infinite-ai/contracts';

import type {
  CycleProgress,
  PdCycleSummary,
  PdJournalEntry,
  SacePdActivityTypeLiteral,
  TypeBreakdown,
} from './types.js';

const ACTIVITY_TYPES: SacePdActivityTypeLiteral[] = [
  'TYPE_1_TEACHER_INITIATED',
  'TYPE_2_SCHOOL_INITIATED',
  'TYPE_3_EXTERNALLY_INITIATED',
];

const EMPTY_BREAKDOWN: Record<SacePdActivityTypeLiteral, TypeBreakdown> = {
  TYPE_1_TEACHER_INITIATED: { verified: 0, pending: 0 },
  TYPE_2_SCHOOL_INITIATED: { verified: 0, pending: 0 },
  TYPE_3_EXTERNALLY_INITIATED: { verified: 0, pending: 0 },
};

/**
 * Determine which year of the CPTD cycle a date falls in, counting from cycleStartDate.
 * Returns 1 if the date is on or before cycleStartDate (treat as start of year 1).
 * Clamps to SACE_CPTD_CYCLE_YEARS (3) if beyond the cycle end.
 */
function resolveCycleYear(date: string, cycleStartDate: string): 1 | 2 | 3 {
  const startMs = new Date(cycleStartDate).getTime();
  const dateMs = new Date(date).getTime();
  if (dateMs <= startMs) return 1;
  const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
  const yearsElapsed = (dateMs - startMs) / MS_PER_YEAR;
  const year = Math.floor(yearsElapsed) + 1;
  if (year < 1) return 1;
  if (year > SACE_CPTD_CYCLE_YEARS) return SACE_CPTD_CYCLE_YEARS as 3;
  return year as 1 | 2 | 3;
}

/**
 * Compute a single educator's CPTD cycle progress from their journal entries.
 *
 * Only entries whose activityDate falls within [cycleStartDate, asOf] are counted.
 * REJECTED entries are excluded from all totals.
 * The cycleYear reported is the year the educator is in as at `asOf`.
 */
export function computeCycleProgress(
  entries: PdJournalEntry[],
  cycleStartDate: string,
  asOf: string,
): CycleProgress {
  if (entries.length === 0) {
    return {
      educatorToken: '',
      cycleYear: resolveCycleYear(asOf, cycleStartDate),
      verifiedPoints: 0,
      pendingPoints: 0,
      totalClaimedPoints: 0,
      breakdownByType: structuredClone(EMPTY_BREAKDOWN),
    };
  }

  const educatorToken = entries[0]!.educatorToken;
  const breakdown: Record<SacePdActivityTypeLiteral, TypeBreakdown> =
    structuredClone(EMPTY_BREAKDOWN);
  let verifiedPoints = 0;
  let pendingPoints = 0;

  const startMs = new Date(cycleStartDate).getTime();
  const asOfMs = new Date(asOf).getTime();

  for (const entry of entries) {
    const entryMs = new Date(entry.activityDate).getTime();
    // Only count entries within the cycle window and not rejected.
    if (entryMs < startMs || entryMs > asOfMs) continue;
    if (entry.pointsStatus === 'REJECTED') continue;

    const slot = breakdown[entry.activityType]!;
    if (entry.pointsStatus === 'VERIFIED') {
      verifiedPoints += entry.claimedPoints;
      slot.verified += entry.claimedPoints;
    } else {
      // PENDING_VERIFICATION
      pendingPoints += entry.claimedPoints;
      slot.pending += entry.claimedPoints;
    }
  }

  return {
    educatorToken,
    cycleYear: resolveCycleYear(asOf, cycleStartDate),
    verifiedPoints,
    pendingPoints,
    totalClaimedPoints: verifiedPoints + pendingPoints,
    breakdownByType: breakdown,
  };
}

/**
 * Build a PdCycleSummary (compatible with PdPointsInput in @infinite-ai/compliance)
 * from a per-educator map of journal entries and cycle start dates.
 *
 * Only verified points are included in pdPointsAccumulated — pending points are not
 * counted for regulatory compliance purposes.
 */
export function buildPdCycleSummary(
  journalsByEducator: Map<string, { entries: PdJournalEntry[]; cycleStartDate: string }>,
  tenantId: string,
  asOf: string,
): PdCycleSummary {
  const educators: PdCycleSummary['educators'] = [];

  for (const [educatorToken, { entries, cycleStartDate }] of journalsByEducator) {
    const tagged = entries.map((e) => ({ ...e, educatorToken }));
    const progress = computeCycleProgress(tagged, cycleStartDate, asOf);
    educators.push({
      educatorToken,
      pdPointsAccumulated: progress.verifiedPoints,
      cycleYear: progress.cycleYear,
    });
  }

  return { tenantId, educators };
}

export { ACTIVITY_TYPES, resolveCycleYear };
