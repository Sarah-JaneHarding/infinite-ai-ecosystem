// Reporting pack — Stage 10 step 6.
//
// "Learner, class, grade, school and district rollups, each respecting purpose limitation."
//
// Two rules enforced here:
// 1. Small-group suppression: any aggregate bucket with fewer than MIN_COHORT_SIZE
//    learners emits a suppression notice rather than counts. This prevents re-identification
//    in small classes or demographic cuts.
// 2. Purpose levels: the four report scopes map to different data categories. The caller
//    must already have resolved access (policy layer); these functions do not re-check.
//    They do, however, strip individual identifiers from class-and-above reports.

export const MIN_COHORT_SIZE = 5;

// ---------------------------------------------------------------------------
// Tier distribution — shared by all rollup levels
// ---------------------------------------------------------------------------

export interface TierDistribution {
  readonly TIER_1: number;
  readonly TIER_2: number;
  readonly TIER_3: number;
  readonly REFERRAL: number;
  readonly total: number;
}

function emptyDistribution(): TierDistribution {
  return { TIER_1: 0, TIER_2: 0, TIER_3: 0, REFERRAL: 0, total: 0 };
}

function addToDistribution(dist: TierDistribution, tier: string): TierDistribution {
  const next = { ...dist, total: dist.total + 1 };
  if (tier === 'TIER_1') return { ...next, TIER_1: next.TIER_1 + 1 };
  if (tier === 'TIER_2') return { ...next, TIER_2: next.TIER_2 + 1 };
  if (tier === 'TIER_3') return { ...next, TIER_3: next.TIER_3 + 1 };
  if (tier === 'REFERRAL') return { ...next, REFERRAL: next.REFERRAL + 1 };
  return next;
}

// ---------------------------------------------------------------------------
// Learner report
// ---------------------------------------------------------------------------

export interface LearnerReport {
  readonly learnerId: string;
  readonly termId: string;
  readonly siasStatus: string;
  readonly currentTier: string | null;
  readonly trendDirection: 'improving' | 'stable' | 'declining' | null;
  readonly recommendation: 'continue' | 'intensify' | 'exit' | null;
  readonly interventionActive: boolean;
  readonly weeksInIntervention: number;
}

// ---------------------------------------------------------------------------
// Class report
// ---------------------------------------------------------------------------

export type SuppressedCohort = { readonly suppressed: true; readonly reason: string };
export type VisibleDistribution = { readonly suppressed: false } & TierDistribution;
export type CohortDistribution = SuppressedCohort | VisibleDistribution;

export interface ClassReport {
  readonly classId: string;
  readonly termId: string;
  readonly tierDistribution: CohortDistribution;
  /** Fraction of learners with an active intervention plan (0–1). */
  readonly interventionRate: number | null;
  /** Fraction of learners with adequate fidelity in the current term (0–1). */
  readonly fidelityRate: number | null;
}

export function rollupClass(
  classId: string,
  termId: string,
  learnerReports: readonly LearnerReport[],
  fidelityAdequateCounts?: { adequate: number; total: number },
): ClassReport {
  if (learnerReports.length < MIN_COHORT_SIZE) {
    return {
      classId,
      termId,
      tierDistribution: {
        suppressed: true,
        reason: `Cohort size ${learnerReports.length} is below the minimum of ${MIN_COHORT_SIZE}`,
      },
      interventionRate: null,
      fidelityRate: null,
    };
  }

  let dist = emptyDistribution();
  let interventionCount = 0;
  for (const r of learnerReports) {
    if (r.currentTier !== null) dist = addToDistribution(dist, r.currentTier);
    if (r.interventionActive) interventionCount++;
  }

  const interventionRate =
    learnerReports.length > 0 ? interventionCount / learnerReports.length : null;
  const fidelityRate =
    fidelityAdequateCounts !== undefined && fidelityAdequateCounts.total > 0
      ? fidelityAdequateCounts.adequate / fidelityAdequateCounts.total
      : null;

  return {
    classId,
    termId,
    tierDistribution: { suppressed: false, ...dist },
    interventionRate,
    fidelityRate,
  };
}

// ---------------------------------------------------------------------------
// Grade report
// ---------------------------------------------------------------------------

export interface GradeReport {
  readonly gradeId: string;
  readonly termId: string;
  readonly tierDistribution: CohortDistribution;
  readonly classCount: number;
  readonly interventionRate: number | null;
}

export function rollupGrade(
  gradeId: string,
  termId: string,
  classReports: readonly ClassReport[],
): GradeReport {
  let aggregateDist = emptyDistribution();
  let _totalLearners = 0;
  let totalWithIntervention = 0;
  let interventionKnown = 0;
  let suppressed = false;

  for (const cr of classReports) {
    if (cr.tierDistribution.suppressed) {
      suppressed = true;
      continue;
    }
    const d = cr.tierDistribution as VisibleDistribution;
    aggregateDist = {
      TIER_1: aggregateDist.TIER_1 + d.TIER_1,
      TIER_2: aggregateDist.TIER_2 + d.TIER_2,
      TIER_3: aggregateDist.TIER_3 + d.TIER_3,
      REFERRAL: aggregateDist.REFERRAL + d.REFERRAL,
      total: aggregateDist.total + d.total,
    };
    _totalLearners += d.total;
    if (cr.interventionRate !== null) {
      totalWithIntervention += cr.interventionRate * d.total;
      interventionKnown += d.total;
    }
  }

  const tierDistribution: CohortDistribution =
    suppressed || aggregateDist.total < MIN_COHORT_SIZE
      ? {
          suppressed: true,
          reason: 'One or more class cohorts were suppressed or total is below minimum',
        }
      : { suppressed: false, ...aggregateDist };

  return {
    gradeId,
    termId,
    tierDistribution,
    classCount: classReports.length,
    interventionRate:
      interventionKnown > 0 ? totalWithIntervention / interventionKnown : null,
  };
}

// ---------------------------------------------------------------------------
// School report
// ---------------------------------------------------------------------------

export interface SchoolReport {
  readonly schoolId: string;
  readonly termId: string;
  readonly tierDistribution: CohortDistribution;
  readonly gradeCount: number;
  readonly interventionRate: number | null;
}

export function rollupSchool(
  schoolId: string,
  termId: string,
  gradeReports: readonly GradeReport[],
): SchoolReport {
  let aggregateDist = emptyDistribution();
  let suppressed = false;
  let totalInterventionNumer = 0;
  let totalInterventionDenom = 0;

  for (const gr of gradeReports) {
    if (gr.tierDistribution.suppressed) {
      suppressed = true;
      continue;
    }
    const d = gr.tierDistribution as VisibleDistribution;
    aggregateDist = {
      TIER_1: aggregateDist.TIER_1 + d.TIER_1,
      TIER_2: aggregateDist.TIER_2 + d.TIER_2,
      TIER_3: aggregateDist.TIER_3 + d.TIER_3,
      REFERRAL: aggregateDist.REFERRAL + d.REFERRAL,
      total: aggregateDist.total + d.total,
    };
    if (gr.interventionRate !== null) {
      totalInterventionNumer += gr.interventionRate * d.total;
      totalInterventionDenom += d.total;
    }
  }

  const tierDistribution: CohortDistribution =
    suppressed || aggregateDist.total < MIN_COHORT_SIZE
      ? {
          suppressed: true,
          reason: 'One or more grade cohorts were suppressed or total is below minimum',
        }
      : { suppressed: false, ...aggregateDist };

  return {
    schoolId,
    termId,
    tierDistribution,
    gradeCount: gradeReports.length,
    interventionRate:
      totalInterventionDenom > 0 ? totalInterventionNumer / totalInterventionDenom : null,
  };
}
