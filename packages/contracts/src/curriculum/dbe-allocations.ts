// packages/contracts/src/curriculum/dbe-allocations.ts
//
// Deterministic DBE Allocation Registry
// ======================================
// Every number in this file is a statutory fact from gazetted DBE regulations.
// NO value may be inferred, estimated, or LLM-generated.
//
// Source authority:
//   Time allocations : Government Gazette No. 36041 (28 Dec 2012), Regulation 21
//                      "Time Allocation", cross-verified against the DBE CAPS
//                      subject-specific documents (Section 1.4 "Time Allocation").
//   Assessment weights: DBE Circular S8 of 2023 — "Revised SBA/Examination
//                       Weightings", confirmed in WCED Annexure A (Jan 2025).
//
// Change policy: append-only. If the DBE gazettes new allocations, add a new
// effective-dated entry; never mutate a historical one. The Curriculum Engine
// resolves by effective date at query time.

import { z } from 'zod';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const DbePhaseSchema = z.enum(['FOUNDATION', 'INTERMEDIATE', 'SENIOR', 'FET']);
export type DbePhase = z.infer<typeof DbePhaseSchema>;

export const DbeSubjectCategorySchema = z.enum([
  'HOME_LANGUAGE',
  'FIRST_ADDITIONAL_LANGUAGE',
  'MATHEMATICS',
  'LIFE_SKILLS',
  'NATURAL_SCIENCES_AND_TECHNOLOGY',
  'NATURAL_SCIENCES',
  'TECHNOLOGY',
  'SOCIAL_SCIENCES',
  'ECONOMIC_AND_MANAGEMENT_SCIENCES',
  'LIFE_ORIENTATION',
  'CREATIVE_ARTS',
]);
export type DbeSubjectCategory = z.infer<typeof DbeSubjectCategorySchema>;

// ─── Types ───────────────────────────────────────────────────────────────────

export type DbeTimeAllocation = {
  readonly category: DbeSubjectCategory;
  readonly hoursPerWeek: number;
};

/**
 * 2023-revised SBA/Examination weightings (Circular S8 of 2023).
 * `sba` + `exam` must equal 100.
 */
export type DbeAssessmentWeighting = {
  readonly sba: number;
  readonly exam: number;
};

export type DbeGradeAllocation = {
  readonly grade: number;
  readonly phase: DbePhase;
  readonly timeAllocations: readonly DbeTimeAllocation[];
  readonly assessmentWeighting: DbeAssessmentWeighting;
  readonly totalHoursPerWeek: number;
  /** ISO-8601 date from which this allocation is effective. */
  readonly effectiveFrom: string;
  /** Regulatory source reference for audit trail. */
  readonly sourceRef: string;
};

// ─── Foundation Phase (Grades R–3) ──────────────────────────────────────────
// Source: Gov. Gazette 36041 Reg. 21; CAPS Life Skills FP §1.4

const FP_TIME_GR_R_TO_2: readonly DbeTimeAllocation[] = [
  { category: 'HOME_LANGUAGE', hoursPerWeek: 6 },
  { category: 'FIRST_ADDITIONAL_LANGUAGE', hoursPerWeek: 4 },
  { category: 'MATHEMATICS', hoursPerWeek: 7 },
  { category: 'LIFE_SKILLS', hoursPerWeek: 6 },
] as const;

const FP_TIME_GR3: readonly DbeTimeAllocation[] = [
  { category: 'HOME_LANGUAGE', hoursPerWeek: 6 },
  { category: 'FIRST_ADDITIONAL_LANGUAGE', hoursPerWeek: 5 },
  { category: 'MATHEMATICS', hoursPerWeek: 7 },
  { category: 'LIFE_SKILLS', hoursPerWeek: 7 },
] as const;

const FP_ASSESSMENT: DbeAssessmentWeighting = { sba: 100, exam: 0 };
const FP_SOURCE = 'Gov. Gazette 36041 Reg.21; Circular S8/2023';

const FP_GR_R: DbeGradeAllocation = {
  grade: 0,
  phase: 'FOUNDATION',
  timeAllocations: FP_TIME_GR_R_TO_2,
  assessmentWeighting: FP_ASSESSMENT,
  totalHoursPerWeek: 23,
  effectiveFrom: '2013-01-01',
  sourceRef: FP_SOURCE,
};

const FP_GR1: DbeGradeAllocation = {
  grade: 1,
  phase: 'FOUNDATION',
  timeAllocations: FP_TIME_GR_R_TO_2,
  assessmentWeighting: FP_ASSESSMENT,
  totalHoursPerWeek: 23,
  effectiveFrom: '2013-01-01',
  sourceRef: FP_SOURCE,
};

const FP_GR2: DbeGradeAllocation = {
  grade: 2,
  phase: 'FOUNDATION',
  timeAllocations: FP_TIME_GR_R_TO_2,
  assessmentWeighting: FP_ASSESSMENT,
  totalHoursPerWeek: 23,
  effectiveFrom: '2013-01-01',
  sourceRef: FP_SOURCE,
};

const FP_GR3: DbeGradeAllocation = {
  grade: 3,
  phase: 'FOUNDATION',
  timeAllocations: FP_TIME_GR3,
  assessmentWeighting: FP_ASSESSMENT,
  totalHoursPerWeek: 25,
  effectiveFrom: '2013-01-01',
  sourceRef: FP_SOURCE,
};

// ─── Intermediate Phase (Grades 4–6) ────────────────────────────────────────
// Source: Gov. Gazette 36041 Reg. 21; CAPS IP subject documents §1.4

const IP_TIME: readonly DbeTimeAllocation[] = [
  { category: 'HOME_LANGUAGE', hoursPerWeek: 6 },
  { category: 'FIRST_ADDITIONAL_LANGUAGE', hoursPerWeek: 5 },
  { category: 'MATHEMATICS', hoursPerWeek: 6 },
  { category: 'NATURAL_SCIENCES_AND_TECHNOLOGY', hoursPerWeek: 3.5 },
  { category: 'SOCIAL_SCIENCES', hoursPerWeek: 3 },
  { category: 'LIFE_SKILLS', hoursPerWeek: 4 },
] as const;

const IP_ASSESSMENT: DbeAssessmentWeighting = { sba: 80, exam: 20 };
const IP_SOURCE = 'Gov. Gazette 36041 Reg.21; Circular S8/2023';

const IP_GR4: DbeGradeAllocation = {
  grade: 4,
  phase: 'INTERMEDIATE',
  timeAllocations: IP_TIME,
  assessmentWeighting: IP_ASSESSMENT,
  totalHoursPerWeek: 27.5,
  effectiveFrom: '2013-01-01',
  sourceRef: IP_SOURCE,
};

const IP_GR5: DbeGradeAllocation = { ...IP_GR4, grade: 5 };
const IP_GR6: DbeGradeAllocation = { ...IP_GR4, grade: 6 };

// ─── Senior Phase (Grades 7–9) ─────────────────────────────────────────────
// Source: Gov. Gazette 36041 Reg. 21; CAPS SP subject documents §1.4

const SP_TIME: readonly DbeTimeAllocation[] = [
  { category: 'HOME_LANGUAGE', hoursPerWeek: 5 },
  { category: 'FIRST_ADDITIONAL_LANGUAGE', hoursPerWeek: 4 },
  { category: 'MATHEMATICS', hoursPerWeek: 4.5 },
  { category: 'NATURAL_SCIENCES', hoursPerWeek: 3 },
  { category: 'SOCIAL_SCIENCES', hoursPerWeek: 3 },
  { category: 'TECHNOLOGY', hoursPerWeek: 2 },
  { category: 'ECONOMIC_AND_MANAGEMENT_SCIENCES', hoursPerWeek: 2 },
  { category: 'LIFE_ORIENTATION', hoursPerWeek: 2 },
  { category: 'CREATIVE_ARTS', hoursPerWeek: 2 },
] as const;

const SP_ASSESSMENT: DbeAssessmentWeighting = { sba: 60, exam: 40 };
const SP_SOURCE = 'Gov. Gazette 36041 Reg.21; Circular S8/2023';

const SP_GR7: DbeGradeAllocation = {
  grade: 7,
  phase: 'SENIOR',
  timeAllocations: SP_TIME,
  assessmentWeighting: SP_ASSESSMENT,
  totalHoursPerWeek: 27.5,
  effectiveFrom: '2013-01-01',
  sourceRef: SP_SOURCE,
};

const SP_GR8: DbeGradeAllocation = { ...SP_GR7, grade: 8 };
const SP_GR9: DbeGradeAllocation = { ...SP_GR7, grade: 9 };

// ─── Registry ───────────────────────────────────────────────────────────────

/**
 * Keyed by grade number (0 = Grade R, 1–9 = Grade 1–9).
 * FET (10–12) is not yet mapped — the pilot targets GET only.
 */
export const DBE_ALLOCATIONS: Readonly<Record<number, DbeGradeAllocation>> = {
  0: FP_GR_R,
  1: FP_GR1,
  2: FP_GR2,
  3: FP_GR3,
  4: IP_GR4,
  5: IP_GR5,
  6: IP_GR6,
  7: SP_GR7,
  8: SP_GR8,
  9: SP_GR9,
};

export function getDbeAllocation(grade: number): DbeGradeAllocation | undefined {
  return DBE_ALLOCATIONS[grade];
}

export function getDbeAllocationsByPhase(phase: DbePhase): readonly DbeGradeAllocation[] {
  return Object.values(DBE_ALLOCATIONS).filter((a) => a.phase === phase);
}

export function assertRegistryIntegrity(): void {
  for (const [gradeStr, alloc] of Object.entries(DBE_ALLOCATIONS)) {
    const sum = alloc.timeAllocations.reduce((s, t) => s + t.hoursPerWeek, 0);
    if (Math.abs(sum - alloc.totalHoursPerWeek) > 0.01) {
      throw new Error(
        `DBE_ALLOCATIONS integrity: grade ${gradeStr} hours sum ${sum} != declared ${alloc.totalHoursPerWeek}`,
      );
    }
    if (alloc.assessmentWeighting.sba + alloc.assessmentWeighting.exam !== 100) {
      throw new Error(
        `DBE_ALLOCATIONS integrity: grade ${gradeStr} sba(${alloc.assessmentWeighting.sba}) + exam(${alloc.assessmentWeighting.exam}) != 100`,
      );
    }
  }
}
