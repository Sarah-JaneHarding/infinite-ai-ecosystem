import {
  SACE_CPTD_CYCLE_YEARS,
  SACE_CPTD_TOTAL_PD_POINTS,
  SACE_PD_POINTS_SCHEDULE_SECTIONS,
} from '@infinite-ai/contracts';

import type { ComplianceFinding, PdPointsInput } from '../types.js';

/** Minimum points an educator should have accumulated by end of cycle year 2.
 *  There is no mandated mid-cycle minimum in the SACE schedule, so this is an
 *  INFO-level advisory (not a VIOLATION).
 */
const EXPECTED_POINTS_BY_YEAR: Record<number, number> = {
  1: 0, // No minimum for year 1 — accumulation starts
  2: 50, // Advisory midpoint (one-third of 150)
  3: SACE_CPTD_TOTAL_PD_POINTS, // Full 150 required at end of cycle
};

export function checkPdPoints(input: PdPointsInput): ComplianceFinding[] {
  const findings: ComplianceFinding[] = [];

  for (const educator of input.educators) {
    const required = EXPECTED_POINTS_BY_YEAR[educator.cycleYear] ?? 0;

    if (
      educator.cycleYear === SACE_CPTD_CYCLE_YEARS &&
      educator.pdPointsAccumulated < required
    ) {
      // End of the 3-year cycle: a shortfall is a compliance VIOLATION.
      findings.push({
        area: 'PD_POINTS',
        severity: 'VIOLATION',
        code: 'PD_POINTS_SHORTFALL_END_OF_CYCLE',
        description: `Educator has accumulated ${educator.pdPointsAccumulated} PD points at the end of the ${SACE_CPTD_CYCLE_YEARS}-year CPTD cycle. The SACE PD Points Schedule requires ${SACE_CPTD_TOTAL_PD_POINTS} points per cycle. SACE may not re-register an educator who has not met this requirement.`,
        basis: SACE_PD_POINTS_SCHEDULE_SECTIONS.totalPointsRequirement,
        context: educator.educatorToken,
      });
    } else if (
      educator.cycleYear < SACE_CPTD_CYCLE_YEARS &&
      educator.pdPointsAccumulated < required
    ) {
      // Mid-cycle advisory — not yet a violation.
      findings.push({
        area: 'PD_POINTS',
        severity: 'INFO',
        code: 'PD_POINTS_BELOW_MIDPOINT_ADVISORY',
        description: `Educator has accumulated ${educator.pdPointsAccumulated} PD points in cycle year ${educator.cycleYear}. An advisory midpoint of ${required} points is suggested to ensure the ${SACE_CPTD_TOTAL_PD_POINTS}-point requirement is met by the end of year ${SACE_CPTD_CYCLE_YEARS}.`,
        basis: SACE_PD_POINTS_SCHEDULE_SECTIONS.totalPointsRequirement,
        context: educator.educatorToken,
      });
    }
  }

  return findings;
}
