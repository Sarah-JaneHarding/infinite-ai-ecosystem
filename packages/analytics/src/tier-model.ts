// The support tier model — Stage 10 step 1.
//
// The four support tiers map directly onto South Africa's SIAS (Screening,
// Identification, Assessment and Support) framework and the international RTI/MTSS model:
//
//   TIER_1    — Universal design for learning; core teaching for all learners.
//   TIER_2    — Targeted small-group support; 15–20% of learners.
//   TIER_3    — Intensive individualised support; 5% of learners.
//   REFERRAL  — Formal external referral; SBST compilation and district submission.
//
// A tier recommendation may only render once the data sufficiency check passes for every
// contributing domain. Below the stated minimum, the caller must surface "insufficient
// data" — never a guess. This is the "Minimum data sufficiency" strict parameter from the
// build manual, enforced here in code rather than in a prompt.

/** The four SIAS support tiers. */
export type SupportTier = 'TIER_1' | 'TIER_2' | 'TIER_3' | 'REFERRAL';

/** The five screening domains used by AC-01 (Universal Screener). */
export type ScreeningDomain =
  'LITERACY' | 'NUMERACY' | 'ATTENDANCE' | 'BEHAVIOUR' | 'WELLBEING';

export const SCREENING_DOMAINS: readonly ScreeningDomain[] = [
  'LITERACY',
  'NUMERACY',
  'ATTENDANCE',
  'BEHAVIOUR',
  'WELLBEING',
];

/**
 * Minimum data requirements before a tier recommendation may render.
 *
 * `minimumDataPoints` is the floor count of evidence records required.
 * `recencyWindowDays` is the maximum age (in days) of the most recent record; a data set
 * whose most recent entry is older than this window is treated as stale and returns
 * 'insufficient', the same as having too few points.
 */
export interface DataSufficiency {
  readonly domain: ScreeningDomain;
  readonly minimumDataPoints: number;
  readonly recencyWindowDays: number;
}

/**
 * Per-domain data sufficiency requirements.
 *
 * These are conservative floors, not recommendations. Attendance data expires faster
 * (30 days) because a learner's attendance pattern can shift quickly — stale data
 * misrepresents risk. Literacy and numeracy are anchored to a term cycle (90 days).
 * Wellbeing is set at one observation within a term; behavioural data needs at least
 * two observations to avoid flagging a single incident as a pattern.
 */
export const DATA_SUFFICIENCY_REQUIREMENTS: Readonly<
  Record<ScreeningDomain, DataSufficiency>
> = {
  LITERACY: { domain: 'LITERACY', minimumDataPoints: 3, recencyWindowDays: 90 },
  NUMERACY: { domain: 'NUMERACY', minimumDataPoints: 3, recencyWindowDays: 90 },
  ATTENDANCE: { domain: 'ATTENDANCE', minimumDataPoints: 10, recencyWindowDays: 30 },
  BEHAVIOUR: { domain: 'BEHAVIOUR', minimumDataPoints: 2, recencyWindowDays: 60 },
  WELLBEING: { domain: 'WELLBEING', minimumDataPoints: 1, recencyWindowDays: 90 },
};

/**
 * A percentile-score band that maps to a support tier.
 *
 * Bands are listed from most intensive to least; the first band whose `scoreBelow`
 * exceeds the learner's score wins. A score at or above every `scoreBelow` resolves to
 * TIER_1, which is why the final band uses 101 (percentile scores are 0–100 inclusive).
 */
export interface TierBand {
  readonly tier: SupportTier;
  /** A learner scoring strictly below this value is placed in this tier. */
  readonly scoreBelow: number;
}

/**
 * Default tier bands.
 *
 * These thresholds are deliberately conservative and school-agnostic; a school's own
 * needs assessment may produce tighter bands, but these defaults ensure that an
 * unconfigured deployment does not under-identify learners who need support.
 */
export const DEFAULT_TIER_BANDS: ReadonlyArray<TierBand> = [
  { tier: 'REFERRAL', scoreBelow: 15 },
  { tier: 'TIER_3', scoreBelow: 35 },
  { tier: 'TIER_2', scoreBelow: 55 },
  { tier: 'TIER_1', scoreBelow: 101 },
];

/**
 * Maps a percentile score (0–100) to a support tier using the provided bands.
 *
 * `bands` must be ordered from most-intensive to least-intensive tier (ascending
 * `scoreBelow`) and must cover the entire 0–100 range. When omitted, {@link DEFAULT_TIER_BANDS}
 * applies.
 */
export function assignTier(
  percentileScore: number,
  bands: ReadonlyArray<TierBand> = DEFAULT_TIER_BANDS,
): SupportTier {
  for (const band of bands) {
    if (percentileScore < band.scoreBelow) return band.tier;
  }
  return 'TIER_1';
}

/** The result of a data-sufficiency check for a single domain. */
export type DataSufficiencyVerdict = 'sufficient' | 'insufficient';

/**
 * Checks whether a single domain has enough recent data for a tier recommendation to
 * render.
 *
 * A recommendation that would render with 'insufficient' data must surface
 * "insufficient data" to the caller — the build manual's strict parameter, enforced at
 * the point of decision rather than in a UI guard.
 */
export function checkDataSufficiency(
  domain: ScreeningDomain,
  dataPointCount: number,
  mostRecentDataAgeInDays: number,
): DataSufficiencyVerdict {
  const req = DATA_SUFFICIENCY_REQUIREMENTS[domain];
  if (dataPointCount < req.minimumDataPoints) return 'insufficient';
  if (mostRecentDataAgeInDays > req.recencyWindowDays) return 'insufficient';
  return 'sufficient';
}

/**
 * Checks every domain at once and returns the overall verdict.
 *
 * All domains must be 'sufficient'; a single 'insufficient' domain blocks the
 * recommendation. The per-domain results are returned so the caller can report which
 * domain(s) are blocking.
 */
export function checkAllDomainsSufficiency(
  readings: ReadonlyArray<{
    readonly domain: ScreeningDomain;
    readonly dataPointCount: number;
    readonly mostRecentDataAgeInDays: number;
  }>,
): {
  readonly overall: DataSufficiencyVerdict;
  readonly byDomain: Readonly<Record<ScreeningDomain, DataSufficiencyVerdict>>;
} {
  const byDomain = {} as Record<ScreeningDomain, DataSufficiencyVerdict>;
  let overall: DataSufficiencyVerdict = 'sufficient';

  for (const r of readings) {
    const verdict = checkDataSufficiency(
      r.domain,
      r.dataPointCount,
      r.mostRecentDataAgeInDays,
    );
    byDomain[r.domain] = verdict;
    if (verdict === 'insufficient') overall = 'insufficient';
  }

  return { overall, byDomain };
}
