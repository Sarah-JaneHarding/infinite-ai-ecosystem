// AC-01 through AC-07 agent I/O schemas — Stage 10 steps 2–3.
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
  /** AC-01 tier results for every learner in the class. Empty array returns needs_input. */
  screenResults: z.array(LearnerTierSummary).min(0),
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

// ---------------------------------------------------------------------------
// AC-03 Tier Recommender
// ---------------------------------------------------------------------------

export const AC03Input = z.object({
  tenantId: z.string().uuid(),
  learnerId: z.string().uuid(),
  classId: z.string().uuid(),
  termId: z.string().uuid(),
  /** The 'ok' screen result from AC-01 for this learner. */
  screenId: z.string().uuid(),
  compositePercentile: z.number().min(0).max(100),
  tier: SupportTierSchema,
  domainSufficiency: z.record(DataSufficiencyVerdictSchema),
  /** Must be 'healthy' — the AC-02 gate; pass the full gatesAc03 flag as proof. */
  coreHealthGate: z.literal(true),
  classHealthRecordId: z.string().uuid(),
});
export type AC03Input = z.infer<typeof AC03Input>;

export const AC03Result = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('recommended'),
    recommendationId: z.string().uuid(),
    learnerId: z.string().uuid(),
    termId: z.string().uuid(),
    tier: SupportTierSchema,
    compositePercentile: z.number().min(0).max(100),
    /** IDs of the evidence records that justify this recommendation. */
    evidenceIds: z.array(z.string()).min(1),
    /** Non-PII rationale text for the SBST to review. */
    rationale: z.string().min(1),
    /** A tier recommendation always initiates SBST review. */
    requiresSbstReview: z.literal(true),
  }),
  z.object({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
    missingFields: z.array(z.string()).min(1),
  }),
]);
export type AC03Result = z.infer<typeof AC03Result>;

// ---------------------------------------------------------------------------
// AC-04 Early Warning Agent
// ---------------------------------------------------------------------------

export const EarlyWarningReading = z.object({
  domain: ScreeningDomainSchema,
  /** Percentile score observed for this reading. */
  percentileScore: z.number().min(0).max(100),
  /** Age of this reading in days. */
  ageInDays: z.number().int().min(0),
  evidenceId: z.string().min(1),
});
export type EarlyWarningReading = z.infer<typeof EarlyWarningReading>;

export const AC04Input = z.object({
  tenantId: z.string().uuid(),
  learnerId: z.string().uuid(),
  classId: z.string().uuid(),
  termId: z.string().uuid(),
  recentReadings: z.array(EarlyWarningReading).min(1),
  /** Composite percentile from the most recent full screen, if available. */
  previousScreenCompositePercentile: z.number().min(0).max(100).optional(),
});
export type AC04Input = z.infer<typeof AC04Input>;

export const RiskLevel = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export type RiskLevel = z.infer<typeof RiskLevel>;

export const EarlyWarningSignal = z.object({
  domain: ScreeningDomainSchema,
  currentPercentile: z.number().min(0).max(100),
  /** Percentile drop that triggered the signal (negative means decline). */
  percentileChange: z.number(),
  evidenceIds: z.array(z.string()).min(1),
});
export type EarlyWarningSignal = z.infer<typeof EarlyWarningSignal>;

export const AC04Result = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('signals_found'),
    warningId: z.string().uuid(),
    learnerId: z.string().uuid(),
    riskLevel: RiskLevel,
    signals: z.array(EarlyWarningSignal).min(1),
    /** True when data has degraded enough that a new full screen is warranted. */
    recommendFullScreen: z.boolean(),
    evidenceIds: z.array(z.string()).min(1),
  }),
  z.object({
    status: z.literal('no_signals'),
    learnerId: z.string().uuid(),
    checkedAt: z.string().datetime(),
    evidenceIds: z.array(z.string()).min(1),
  }),
  z.object({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
  }),
]);
export type AC04Result = z.infer<typeof AC04Result>;

// ---------------------------------------------------------------------------
// AC-05 Intervention Planner
// ---------------------------------------------------------------------------

export const InterventionDosage = z.object({
  sessionsPerWeek: z.number().int().min(1).max(7),
  minutesPerSession: z.number().int().min(10).max(120),
});
export type InterventionDosage = z.infer<typeof InterventionDosage>;

export const AC05Input = z.object({
  tenantId: z.string().uuid(),
  learnerId: z.string().uuid(),
  termId: z.string().uuid(),
  /** Only TIER_2/TIER_3 learners receive intervention plans. */
  tier: z.enum(['TIER_2', 'TIER_3']),
  targetDomains: z.array(ScreeningDomainSchema).min(1),
  compositePercentile: z.number().min(0).max(100),
  /** Proof that SBST ratified the tier before a plan was requested. */
  sbstRatificationId: z.string().uuid(),
  /** Evidence IDs from AC-03 recommendation that SBST approved. */
  evidenceIds: z.array(z.string()).min(1),
});
export type AC05Input = z.infer<typeof AC05Input>;

export const AC05Result = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('planned'),
    planId: z.string().uuid(),
    learnerId: z.string().uuid(),
    termId: z.string().uuid(),
    tier: z.enum(['TIER_2', 'TIER_3']),
    targetDomains: z.array(ScreeningDomainSchema).min(1),
    /** Specific, measurable goal statement (no PII, no diagnostic language). */
    goal: z.string().min(1),
    /** Evidence-based strategy description. */
    strategy: z.string().min(1),
    dosage: InterventionDosage,
    durationWeeks: z.number().int().min(4).max(20),
    /** Responsible role (e.g. "Learning Support Educator") — never a named person. */
    ownerRole: z.string().min(1),
    evidenceIds: z.array(z.string()).min(1),
  }),
  z.object({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
    missingFields: z.array(z.string()).min(1),
  }),
]);
export type AC05Result = z.infer<typeof AC05Result>;

// ---------------------------------------------------------------------------
// AC-06 Progress Monitor
// ---------------------------------------------------------------------------

export const ProgressMeasurement = z.object({
  /** ISO date string of the measurement. */
  measuredOn: z.string().date(),
  domain: ScreeningDomainSchema,
  percentileScore: z.number().min(0).max(100),
  evidenceId: z.string().min(1),
});
export type ProgressMeasurement = z.infer<typeof ProgressMeasurement>;

export const TrendDirection = z.enum(['improving', 'stable', 'declining']);
export type TrendDirection = z.infer<typeof TrendDirection>;

export const MonitoringRecommendation = z.enum(['continue', 'intensify', 'exit']);
export type MonitoringRecommendation = z.infer<typeof MonitoringRecommendation>;

export const AC06Input = z.object({
  tenantId: z.string().uuid(),
  learnerId: z.string().uuid(),
  termId: z.string().uuid(),
  planId: z.string().uuid(),
  measurements: z.array(ProgressMeasurement).min(2),
  goalPercentile: z.number().min(0).max(100),
  weeksSinceIntervention: z.number().int().min(1),
});
export type AC06Input = z.infer<typeof AC06Input>;

export const AC06Result = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('monitored'),
    monitorId: z.string().uuid(),
    learnerId: z.string().uuid(),
    termId: z.string().uuid(),
    planId: z.string().uuid(),
    trendDirection: TrendDirection,
    currentPercentile: z.number().min(0).max(100),
    goalPercentile: z.number().min(0).max(100),
    /** Percentile points gained per week (negative means regression). */
    progressRatePerWeek: z.number(),
    recommendation: MonitoringRecommendation,
    evidenceIds: z.array(z.string()).min(1),
    detail: z.string().min(1),
  }),
  z.object({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
  }),
]);
export type AC06Result = z.infer<typeof AC06Result>;

// ---------------------------------------------------------------------------
// AC-07 Fidelity Checker
// ---------------------------------------------------------------------------

export const PlannedSession = z.object({
  /** ISO date string when the session was scheduled. */
  scheduledOn: z.string().date(),
  domain: ScreeningDomainSchema,
  plannedMinutes: z.number().int().min(10).max(120),
});
export type PlannedSession = z.infer<typeof PlannedSession>;

export const DeliveredSession = z.object({
  /** ISO date string when the session was actually delivered. */
  deliveredOn: z.string().date(),
  domain: ScreeningDomainSchema,
  deliveredMinutes: z.number().int().min(0),
  /** De-identified role, never a named person. */
  deliveredByRole: z.string().min(1),
  evidenceId: z.string().min(1),
});
export type DeliveredSession = z.infer<typeof DeliveredSession>;

export const AC07Input = z.object({
  tenantId: z.string().uuid(),
  learnerId: z.string().uuid(),
  termId: z.string().uuid(),
  planId: z.string().uuid(),
  plannedSessions: z.array(PlannedSession).min(1),
  deliveredSessions: z.array(DeliveredSession).min(0),
  /** Evidence IDs for the plan document itself. */
  planEvidenceIds: z.array(z.string()).min(1),
});
export type AC07Input = z.infer<typeof AC07Input>;

export const AC07Result = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('adequate'),
    fidelityId: z.string().uuid(),
    learnerId: z.string().uuid(),
    termId: z.string().uuid(),
    planId: z.string().uuid(),
    plannedSessionCount: z.number().int().min(1),
    deliveredSessionCount: z.number().int().min(0),
    /** Delivery rate as a percentage (0–100). ≥80 % is 'adequate'. */
    fidelityRate: z.number().min(0).max(100),
    evidenceIds: z.array(z.string()).min(1),
    detail: z.string().min(1),
  }),
  z.object({
    status: z.literal('inadequate'),
    fidelityId: z.string().uuid(),
    learnerId: z.string().uuid(),
    termId: z.string().uuid(),
    planId: z.string().uuid(),
    plannedSessionCount: z.number().int().min(1),
    deliveredSessionCount: z.number().int().min(0),
    fidelityRate: z.number().min(0).max(100),
    evidenceIds: z.array(z.string()).min(1),
    detail: z.string().min(1),
  }),
  z.object({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
  }),
]);
export type AC07Result = z.infer<typeof AC07Result>;
