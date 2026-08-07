// AC-01 and AC-02 agent I/O schemas — Stage 10 step 2.
//
// AC-01 (Universal Screener): takes per-domain data readings, checks sufficiency,
// computes a composite percentile, and assigns a preliminary tier.
//
// AC-02 (Core-Health Analyst): takes the class's AC-01 results and determines whether
// Tier 1 is sufficient for ≥80% of the class. If not, individual tier recommendations
// are suppressed and a Tier 1 improvement task is raised instead. This is the gate that
// must pass before AC-03 (Tier Recommender) is allowed to run.

import { z } from 'zod';

import { SCREENING_DOMAINS } from './tier-model.js';

// ---------------------------------------------------------------------------
// Re-export domain + tier enums as Zod schemas so agent I/O is independently parseable
// ---------------------------------------------------------------------------

export const ScreeningDomainSchema = z.enum(
  SCREENING_DOMAINS as unknown as [string, ...string[]],
);

export const SupportTierSchema = z.enum(['TIER_1', 'TIER_2', 'TIER_3', 'REFERRAL']);

export const DataSufficiencyVerdictSchema = z.enum(['sufficient', 'insufficient']);

// ---------------------------------------------------------------------------
// AC-01 Universal Screener
// ---------------------------------------------------------------------------

/** One domain's reading supplied to the screener. */
export const DomainReading = z.object({
  domain: ScreeningDomainSchema,
  /** Percentile score for this domain (0–100). */
  percentileScore: z.number().min(0).max(100),
  dataPointCount: z.number().int().min(0),
  mostRecentDataAgeInDays: z.number().int().min(0),
});
export type DomainReading = z.infer<typeof DomainReading>;

export const AC01Input = z.object({
  tenantId: z.string().uuid(),
  learnerId: z.string().uuid(),
  termId: z.string().uuid(),
  /** Readings for each domain. At least one is required. */
  domainReadings: z.array(DomainReading).min(1),
});
export type AC01Input = z.infer<typeof AC01Input>;

export const AC01Result = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    screenId: z.string().uuid(),
    learnerId: z.string().uuid(),
    termId: z.string().uuid(),
    /** Mean of the supplied domain percentile scores. */
    compositePercentile: z.number().min(0).max(100),
    tier: SupportTierSchema,
    domainSufficiency: z.record(DataSufficiencyVerdictSchema),
    overallSufficiency: DataSufficiencyVerdictSchema,
  }),
  z.object({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
    /** Domains that failed the data-sufficiency check. */
    insufficientDomains: z.array(ScreeningDomainSchema).min(1),
  }),
  z.object({
    status: z.literal('safeguarding'),
    detail: z.string().min(1),
    escalatedAt: z.string().datetime(),
  }),
]);
export type AC01Result = z.infer<typeof AC01Result>;

// ---------------------------------------------------------------------------
// AC-02 Core-Health Analyst
// ---------------------------------------------------------------------------

/** One learner's tier as reported by AC-01, used in the class-level health check. */
export const LearnerTierSummary = z.object({
  learnerId: z.string().uuid(),
  tier: SupportTierSchema,
});
export type LearnerTierSummary = z.infer<typeof LearnerTierSummary>;

export const AC02Input = z.object({
  tenantId: z.string().uuid(),
  classId: z.string().uuid(),
  termId: z.string().uuid(),
  /** AC-01 tier results for every learner in the class. At least one is required. */
  screenResults: z.array(LearnerTierSummary).min(1),
});
export type AC02Input = z.infer<typeof AC02Input>;

export const AC02Result = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('healthy'),
    /** Percentage of learners in TIER_1, rounded to two decimal places. */
    tier1Percentage: z.number().min(0).max(100),
    learnerCount: z.number().int().min(1),
    tier1Count: z.number().int().min(0),
    /** Always true when healthy: AC-03 is permitted to run for this class. */
    gatesAc03: z.literal(true),
  }),
  z.object({
    status: z.literal('blocked'),
    tier1Percentage: z.number().min(0).max(100),
    learnerCount: z.number().int().min(1),
    tier1Count: z.number().int().min(0),
    /** Always false when blocked: AC-03 must not run until core health recovers. */
    gatesAc03: z.literal(false),
    detail: z.string().min(1),
  }),
  z.object({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
  }),
]);
export type AC02Result = z.infer<typeof AC02Result>;
