import { BELA_ACT_2024_SECTIONS, SASA_1996_SECTIONS } from '@infinite-ai/contracts';

import type { AttendanceInput, ComplianceFinding } from '../types.js';

/** Grade R compulsory attendance applies from the 2025 academic year (BELA Act 32/2024,
 *  assented 13 September 2024; effective on a date determined by the President —
 *  operationally treated as the start of the 2025 school year).
 */
const BELA_GRADE_R_EFFECTIVE_YEAR = 2025;

/** Attendance rate below this percentage triggers a WARNING finding. */
const LOW_ATTENDANCE_THRESHOLD_PCT = 80;

export function checkAttendance(input: AttendanceInput): ComplianceFinding[] {
  const findings: ComplianceFinding[] = [];

  for (const learner of input.learners) {
    const isGradeR = learner.grade === 'R' || learner.grade === 'Grade R';

    // BELA §1 amends SASA §3: Grade R attendance is compulsory from 2025.
    // Attendance must be tracked — a rate of exactly 0 for an active Grade R learner
    // in or after the effective year is a VIOLATION.
    if (
      isGradeR &&
      input.academicYear >= BELA_GRADE_R_EFFECTIVE_YEAR &&
      learner.attendanceRatePct === 0
    ) {
      findings.push({
        area: 'ATTENDANCE',
        severity: 'VIOLATION',
        code: 'GRADE_R_ATTENDANCE_NOT_TRACKED',
        description:
          'Grade R attendance must be tracked. BELA Act 32 of 2024 makes Grade R attendance compulsory from 2025; a recorded rate of 0% suggests attendance is not being monitored.',
        basis: BELA_ACT_2024_SECTIONS.gradeRCompulsoryAttendance,
        context: learner.learnerId,
      });
    }

    // Any learner (including Grade R) with an attendance rate below the threshold.
    if (learner.attendanceRatePct < LOW_ATTENDANCE_THRESHOLD_PCT) {
      findings.push({
        area: 'ATTENDANCE',
        severity: 'WARNING',
        code: 'LOW_ATTENDANCE_RATE',
        description: `Learner attendance rate is ${learner.attendanceRatePct}%, below the ${LOW_ATTENDANCE_THRESHOLD_PCT}% threshold. SASA §3 requires compulsory school attendance; sustained low rates should be investigated and documented.`,
        basis: SASA_1996_SECTIONS.compulsoryAttendance,
        context: learner.learnerId,
      });
    }
  }

  return findings;
}
