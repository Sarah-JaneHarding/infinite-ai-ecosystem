// packages/curriculum-seed/src/apply-dbe-overlay.ts
//
// Deterministic post-processor for CE-01.
// Injects statutory DBE time allocations and assessment weightings
// into the GradeFramework returned by the Model Gateway.
//
// Design principle: the LLM structures the curriculum (topics, sequencing,
// content descriptions); the DBE registry supplies the legal facts
// (hours, weightings). The two never cross responsibilities.

import { getDbeAllocation, mapSubjectToCategory } from '@infinite-ai/contracts';
import type { DbeAssessmentWeighting } from '@infinite-ai/contracts';

// ─── Types ──────────────────────────────────────────────────────────────────

export type SubjectFramework = {
  name: string;
  hoursPerWeek?: number;
  assessmentWeighting?: DbeAssessmentWeighting;
  [key: string]: unknown;
};

export type GradeFramework = {
  grade: string;
  subjects: SubjectFramework[];
  totalHoursPerWeek?: number;
  [key: string]: unknown;
};

export type OverlayMappedSubject = {
  readonly name: string;
  readonly category: string;
  readonly hoursPerWeek: number;
};

export type OverlayReport = {
  readonly grade: number;
  readonly phase: string;
  readonly mappedSubjects: readonly OverlayMappedSubject[];
  readonly unmappedSubjects: readonly string[];
  readonly totalHoursPerWeek: number;
  readonly assessmentWeighting: DbeAssessmentWeighting;
  readonly sourceRef: string;
  /** False when any subject could not be mapped — CE-01 must return needs_input. */
  readonly isComplete: boolean;
};

// ─── Grade parser ───────────────────────────────────────────────────────────

function parseGradeNumber(gradeString: string): number | null {
  const lower = gradeString.toLowerCase().trim();
  if (lower === 'grade r' || lower === 'gr r' || lower === 'r') return 0;
  const match = lower.match(/(?:grade|gr)\.?\s*(\d+)/i) ?? lower.match(/^(\d+)$/);
  if (!match || match[1] === undefined) return null;
  const num = parseInt(match[1], 10);
  return num >= 0 && num <= 12 ? num : null;
}

// ─── Core overlay function ──────────────────────────────────────────────────

/**
 * Applies statutory DBE allocations to a GradeFramework.
 *
 * - Subjects that map to a known DbeSubjectCategory get `hoursPerWeek`
 *   and `assessmentWeighting` overwritten with gazette values.
 * - Subjects that do NOT map are left untouched and reported in
 *   `OverlayReport.unmappedSubjects`.
 * - If ANY subject is unmapped, `isComplete` is `false`, and CE-01 should
 *   surface `needs_input` rather than shipping an incomplete framework.
 *
 * @returns A tuple of [enrichedFramework, report].
 */
export function applyDbeOverlay(
  framework: GradeFramework,
): [GradeFramework, OverlayReport] {
  const gradeNum = parseGradeNumber(framework.grade);

  if (gradeNum === null) {
    return [
      framework,
      {
        grade: -1,
        phase: 'UNKNOWN',
        mappedSubjects: [],
        unmappedSubjects: framework.subjects.map((s) => s.name),
        totalHoursPerWeek: 0,
        assessmentWeighting: { sba: 0, exam: 0 },
        sourceRef: 'N/A — grade not recognised',
        isComplete: false,
      },
    ];
  }

  const allocation = getDbeAllocation(gradeNum);

  if (!allocation) {
    return [
      framework,
      {
        grade: gradeNum,
        phase: 'UNMAPPED',
        mappedSubjects: [],
        unmappedSubjects: framework.subjects.map((s) => s.name),
        totalHoursPerWeek: 0,
        assessmentWeighting: { sba: 0, exam: 0 },
        sourceRef: 'N/A — grade outside GET registry',
        isComplete: false,
      },
    ];
  }

  const mappedSubjects: OverlayMappedSubject[] = [];
  const unmappedSubjects: string[] = [];

  const enrichedSubjects: SubjectFramework[] = framework.subjects.map((subject) => {
    const category = mapSubjectToCategory(subject.name);

    if (!category) {
      unmappedSubjects.push(subject.name);
      return subject;
    }

    const timeAlloc = allocation.timeAllocations.find((t) => t.category === category);

    if (!timeAlloc) {
      // Category exists in the enum but not in this phase's table
      // (e.g. LIFE_ORIENTATION in Foundation Phase). Honest gap.
      unmappedSubjects.push(subject.name);
      return subject;
    }

    mappedSubjects.push({
      name: subject.name,
      category,
      hoursPerWeek: timeAlloc.hoursPerWeek,
    });

    return {
      ...subject,
      hoursPerWeek: timeAlloc.hoursPerWeek,
      assessmentWeighting: allocation.assessmentWeighting,
    };
  });

  const enrichedFramework: GradeFramework = {
    ...framework,
    subjects: enrichedSubjects,
    totalHoursPerWeek: allocation.totalHoursPerWeek,
  };

  const report: OverlayReport = {
    grade: gradeNum,
    phase: allocation.phase,
    mappedSubjects,
    unmappedSubjects,
    totalHoursPerWeek: allocation.totalHoursPerWeek,
    assessmentWeighting: allocation.assessmentWeighting,
    sourceRef: allocation.sourceRef,
    isComplete: unmappedSubjects.length === 0,
  };

  return [enrichedFramework, report];
}
