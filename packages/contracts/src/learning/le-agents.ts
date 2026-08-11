// LE Learning Engine agent input/output schemas — Stage 13.
//
// LE-01 Signal Collector    — labels every HITL event (approval, edit, rejection) as a learning event.
// LE-02 Correction Differ   — classifies what the human changed and the correction type.
// LE-03 Outcome Attributor  — artefact → delivery → learner result with attribution method + confidence.
// LE-04 Pattern Miner       — effect sizes, confidence intervals, minimum sample threshold enforced.
// LE-05 Exemplar Curator    — promotes best artefacts into L3 as candidates (never directly).
// LE-06 Prompt Evolver      — produces challenger prompt variants from recurring corrections (candidates only).
// LE-07 Eval Gatekeeper     — champion vs challenger scoring; promotion requires passing; impossible to bypass.
// LE-08 Commons Publisher   — k-anonymity enforcement; a below-threshold pattern cannot be published.
// LE-09 Decay & Revalidation — TTL enforcement; CAPS or ATP version change invalidates dependents.
//
// Cross-cutting rules enforced at the schema level:
//
// 1. Learning is tenant-local by default. Cross-tenant publication requires explicit opt-in, de-identification,
//    aggregation, and a k-anonymity threshold checked at publish time.
// 2. Human corrections outrank model confidence, always.
// 3. Every promotion is versioned and reversible. A rollback command exists and restores exactly.
// 4. LE-05 and LE-06 produce candidates ONLY. Nothing enters L3 without human ratification (step 6).
// 5. Feedback loops are audited for bias drift. A bias-divergent pattern is blocked.
// 6. LE-03 records attribution method and confidence; never presents correlation as proof.

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared fragments
// ---------------------------------------------------------------------------

const LEOutputBase = z.object({
  tenantId: z.string().uuid(),
  processedAt: z.string().datetime(),
});

// ---------------------------------------------------------------------------
// LE-01 — Signal Collector
// ---------------------------------------------------------------------------

/** The outcome of the HITL gate — approved, edited (approved with changes), or rejected. */
export const HITLEventType = z.enum(['approved', 'edited', 'rejected']);
export type HITLEventType = z.infer<typeof HITLEventType>;

export const LE01Input = z.object({
  tenantId: z.string().uuid(),
  /** The HITL gate event to classify. Comes from Stage 06/11's HumanGateDecision records. */
  gateEventId: z.string().uuid(),
  agentId: z.string().min(1),
  artefactId: z.string().uuid(),
  artefactType: z.string().min(1),
  capsTopicId: z.string().min(1),
  eventType: HITLEventType,
  /** Reason code supplied by the teacher when rejecting or editing. Required on rejection. */
  reasonCode: z.string().min(1).optional(),
  /** Actor who made the decision — de-identified (role + school context, no natural key). */
  actorRef: z.string().min(1),
  decidedAt: z.string().datetime(),
});
export type LE01Input = z.infer<typeof LE01Input>;

/** A labelled learning event ready for downstream LE agents. */
export const LabelledLearningEvent = z.object({
  eventId: z.string().uuid(),
  tenantId: z.string().uuid(),
  agentId: z.string().min(1),
  artefactId: z.string().uuid(),
  artefactType: z.string().min(1),
  capsTopicId: z.string().min(1),
  label: HITLEventType,
  /** Reason code, present when the teacher supplied one. */
  reasonCode: z.string().min(1).optional(),
  actorRef: z.string().min(1),
  decidedAt: z.string().datetime(),
  collectedAt: z.string().datetime(),
});
export type LabelledLearningEvent = z.infer<typeof LabelledLearningEvent>;

export const LE01Result = z.discriminatedUnion('status', [
  LEOutputBase.extend({
    status: z.literal('ok'),
    event: LabelledLearningEvent,
  }),
  LEOutputBase.extend({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
    missingFields: z.array(z.string().min(1)).min(1),
  }),
]);
export type LE01Result = z.infer<typeof LE01Result>;

// ---------------------------------------------------------------------------
// LE-02 — Correction Differ
// ---------------------------------------------------------------------------

/** The type of correction the teacher made — classified from the edit diff. */
export const CorrectionType = z.enum([
  /** Factual correction — a claim that was wrong or unsupported. */
  'factual',
  /** Curriculum alignment — the content did not match CAPS/ATP requirements. */
  'curriculum_alignment',
  /** Tone or language register — too formal, too casual, or inappropriate for the audience. */
  'tone',
  /** Readability — grade-level mismatch or unclear phrasing. */
  'readability',
  /** Template structure — the artefact did not follow the expected template. */
  'template_structure',
  /** Completeness — key required sections or examples were missing. */
  'completeness',
  /** Other — teacher-supplied reason does not map to the above types. */
  'other',
]);
export type CorrectionType = z.infer<typeof CorrectionType>;

export const LE02Input = z.object({
  tenantId: z.string().uuid(),
  learningEventId: z.string().uuid(),
  agentId: z.string().min(1),
  artefactId: z.string().uuid(),
  artefactType: z.string().min(1),
  capsTopicId: z.string().min(1),
  /** The edit diff captured by Stage 11's toolbox.capture_edit_signal. */
  editDiff: z.object({
    fieldEdits: z
      .array(
        z.object({
          field: z.string().min(1),
          before: z.string().min(1),
          after: z.string().min(1),
        }),
      )
      .min(1),
    totalCharactersChanged: z.number().int().nonnegative(),
    editedAt: z.string().datetime(),
  }),
  /** Optional reason code from the teacher. */
  reasonCode: z.string().min(1).optional(),
});
export type LE02Input = z.infer<typeof LE02Input>;

export const FieldCorrection = z.object({
  field: z.string().min(1),
  correctionType: CorrectionType,
  /** Magnitude: absolute characters changed for this field. */
  characterDelta: z.number().int().nonnegative(),
});
export type FieldCorrection = z.infer<typeof FieldCorrection>;

export const LE02Result = z.discriminatedUnion('status', [
  LEOutputBase.extend({
    status: z.literal('ok'),
    learningEventId: z.string().uuid(),
    agentId: z.string().min(1),
    artefactId: z.string().uuid(),
    capsTopicId: z.string().min(1),
    /** Dominant correction type across all field edits. */
    primaryCorrectionType: CorrectionType,
    /** Per-field breakdown. */
    fieldCorrections: z.array(FieldCorrection).min(1),
    totalCharactersChanged: z.number().int().nonnegative(),
    classifiedAt: z.string().datetime(),
  }),
  LEOutputBase.extend({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
    missingFields: z.array(z.string().min(1)).min(1),
  }),
]);
export type LE02Result = z.infer<typeof LE02Result>;

// ---------------------------------------------------------------------------
// LE-03 — Outcome Attributor
// ---------------------------------------------------------------------------

/** Attribution method — how the link between artefact and outcome was established. */
export const AttributionMethod = z.enum([
  /** Delivery was followed by a measurable outcome within the expected window. Correlation only. */
  'temporal_proximity',
  /** Matched learner cohort with and without artefact delivery. Quasi-experimental. */
  'cohort_comparison',
  /** Pre/post assessment scores for the same learner group. Observational. */
  'pre_post_assessment',
  /** Teacher explicitly linked the artefact to the outcome in their feedback. */
  'teacher_reported',
]);
export type AttributionMethod = z.infer<typeof AttributionMethod>;

export const LE03Input = z.object({
  tenantId: z.string().uuid(),
  artefactId: z.string().uuid(),
  artefactType: z.string().min(1),
  agentId: z.string().min(1),
  capsTopicId: z.string().min(1),
  /** Learner outcome signals — anonymised and de-identified before this agent sees them. */
  outcomeSignals: z
    .array(
      z.object({
        /** Anonymised learner cohort token — never a natural key. */
        cohortRef: z.string().min(1),
        gradeLabel: z.string().min(1),
        /** Pre-delivery baseline score (0–100). Null if not available. */
        baselineScore: z.number().min(0).max(100).nullable(),
        /** Post-delivery score (0–100). Null if not yet available. */
        postScore: z.number().min(0).max(100).nullable(),
        outcomeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .min(1),
  deliveredAt: z.string().datetime(),
  attributionWindowDays: z.number().int().positive(),
});
export type LE03Input = z.infer<typeof LE03Input>;

export const LE03Result = z.discriminatedUnion('status', [
  LEOutputBase.extend({
    status: z.literal('ok'),
    artefactId: z.string().uuid(),
    agentId: z.string().min(1),
    capsTopicId: z.string().min(1),
    method: AttributionMethod,
    /** 0–1 confidence score — how reliable this attribution is. Always stated, never hidden. */
    confidence: z.number().min(0).max(1),
    /** Plain-language description of the attribution and its limitations. */
    methodNote: z.string().min(1),
    cohortSize: z.number().int().positive(),
    meanScoreDelta: z.number().nullable(),
    attributedAt: z.string().datetime(),
  }),
  LEOutputBase.extend({
    status: z.literal('insufficient_data'),
    detail: z.string().min(1),
    /** Minimum cohort size required. */
    requiredCohortSize: z.number().int().positive(),
    actualCohortSize: z.number().int().nonnegative(),
  }),
  LEOutputBase.extend({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
    missingFields: z.array(z.string().min(1)).min(1),
  }),
]);
export type LE03Result = z.infer<typeof LE03Result>;

// ---------------------------------------------------------------------------
// LE-04 — Pattern Miner
// ---------------------------------------------------------------------------

/** Minimum number of attributed outcomes required to mine a pattern. Enforced in LE-04. */
export const PATTERN_MIN_SAMPLE_SIZE = 10 as const;

export const LE04Input = z.object({
  tenantId: z.string().uuid(),
  capsTopicId: z.string().min(1),
  /** Attribution records from LE-03 to mine patterns from. Min 1. */
  attributions: z
    .array(
      z.object({
        artefactId: z.string().uuid(),
        agentId: z.string().min(1),
        method: AttributionMethod,
        confidence: z.number().min(0).max(1),
        cohortSize: z.number().int().positive(),
        meanScoreDelta: z.number().nullable(),
      }),
    )
    .min(1),
  /** Stratification fields for bias-drift check — e.g. language group, grade. */
  stratificationFields: z.array(z.string().min(1)),
});
export type LE04Input = z.infer<typeof LE04Input>;

export const MinedPattern = z.object({
  patternId: z.string().uuid(),
  capsTopicId: z.string().min(1),
  agentId: z.string().min(1),
  sampleSize: z.number().int().min(PATTERN_MIN_SAMPLE_SIZE),
  /** Mean score delta across all attributed outcomes. */
  effectSize: z.number(),
  /** 95% confidence interval. */
  confidenceInterval: z.tuple([z.number(), z.number()]),
  /** Whether the pattern's effect is consistent across stratification groups. */
  biasChecked: z.boolean(),
  /** Set when bias check finds divergence across stratification groups. */
  biasDivergenceNote: z.string().min(1).optional(),
  minedAt: z.string().datetime(),
});
export type MinedPattern = z.infer<typeof MinedPattern>;

export const LE04Result = z.discriminatedUnion('status', [
  LEOutputBase.extend({
    status: z.literal('ok'),
    patterns: z.array(MinedPattern).min(1),
    patternsBlockedForBiasDivergence: z.number().int().nonnegative(),
  }),
  LEOutputBase.extend({
    status: z.literal('below_threshold'),
    detail: z.string().min(1),
    required: z.literal(PATTERN_MIN_SAMPLE_SIZE),
    actual: z.number().int().nonnegative(),
  }),
  LEOutputBase.extend({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
    missingFields: z.array(z.string().min(1)).min(1),
  }),
]);
export type LE04Result = z.infer<typeof LE04Result>;

// ---------------------------------------------------------------------------
// LE-05 — Exemplar Curator
// ---------------------------------------------------------------------------

export const LE05Input = z.object({
  tenantId: z.string().uuid(),
  capsTopicId: z.string().min(1),
  agentId: z.string().min(1),
  /** Artefacts with their eval scores and attribution confidence. */
  candidates: z
    .array(
      z.object({
        artefactId: z.string().uuid(),
        evalScore: z.number().min(0).max(1),
        firstPassAcceptanceRate: z.number().min(0).max(1),
        attributionConfidence: z.number().min(0).max(1),
      }),
    )
    .min(1),
});
export type LE05Input = z.infer<typeof LE05Input>;

/** An exemplar candidate — not yet promoted; requires human ratification (step 6). */
export const ExemplarCandidate = z.object({
  candidateId: z.string().uuid(),
  artefactId: z.string().uuid(),
  capsTopicId: z.string().min(1),
  agentId: z.string().min(1),
  /** Composite score: weighted combination of evalScore, firstPassAcceptanceRate, attribution. */
  compositeScore: z.number().min(0).max(1),
  rationale: z.string().min(1),
  proposedAt: z.string().datetime(),
  /** Always false until LE-07 clears it and a human ratifies. */
  promoted: z.literal(false),
});
export type ExemplarCandidate = z.infer<typeof ExemplarCandidate>;

export const LE05Result = z.discriminatedUnion('status', [
  LEOutputBase.extend({
    status: z.literal('ok'),
    candidates: z.array(ExemplarCandidate).min(1),
  }),
  LEOutputBase.extend({
    status: z.literal('no_candidates'),
    detail: z.string().min(1),
  }),
  LEOutputBase.extend({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
    missingFields: z.array(z.string().min(1)).min(1),
  }),
]);
export type LE05Result = z.infer<typeof LE05Result>;

// ---------------------------------------------------------------------------
// LE-06 — Prompt Evolver
// ---------------------------------------------------------------------------

export const LE06Input = z.object({
  tenantId: z.string().uuid(),
  agentId: z.string().min(1),
  /** Current champion prompt text and version. */
  championPrompt: z.object({
    version: z.string().min(1),
    content: z.string().min(1),
  }),
  /** Recurring correction patterns that suggest the prompt needs improvement. */
  correctionPatterns: z
    .array(
      z.object({
        correctionType: CorrectionType,
        frequency: z.number().int().positive(),
        representativeExample: z.string().min(1),
      }),
    )
    .min(1),
});
export type LE06Input = z.infer<typeof LE06Input>;

/** A challenger prompt candidate — never a live champion; requires LE-07 + ratification. */
export const PromptChallenger = z.object({
  challengerId: z.string().uuid(),
  agentId: z.string().min(1),
  challengerVersion: z.string().min(1),
  content: z.string().min(1),
  /** What corrections this challenger addresses. */
  addressedCorrectionTypes: z.array(CorrectionType).min(1),
  rationale: z.string().min(1),
  proposedAt: z.string().datetime(),
  /** Always false until LE-07 gates it and a human ratifies. */
  isLive: z.literal(false),
});
export type PromptChallenger = z.infer<typeof PromptChallenger>;

export const LE06Result = z.discriminatedUnion('status', [
  LEOutputBase.extend({
    status: z.literal('ok'),
    challenger: PromptChallenger,
  }),
  LEOutputBase.extend({
    status: z.literal('no_improvement_found'),
    detail: z.string().min(1),
  }),
  LEOutputBase.extend({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
    missingFields: z.array(z.string().min(1)).min(1),
  }),
]);
export type LE06Result = z.infer<typeof LE06Result>;

// ---------------------------------------------------------------------------
// LE-07 — Eval Gatekeeper
// ---------------------------------------------------------------------------

/** Gatekeeper verdict — must be 'promote' for the challenger to proceed to ratification. */
export const GatekeeperVerdict = z.enum([
  /** Challenger beats champion on all must_not_regress cases and overall score. */
  'promote',
  /** Challenger regresses one or more must_not_regress cases — hard block. */
  'reject_regression',
  /** Challenger does not beat champion on overall score. */
  'reject_no_improvement',
  /** Challenger shows bias divergence across stratification groups. */
  'reject_bias_divergence',
]);
export type GatekeeperVerdict = z.infer<typeof GatekeeperVerdict>;

export const LE07Input = z.object({
  tenantId: z.string().uuid(),
  agentId: z.string().min(1),
  challengerId: z.string().uuid(),
  /** Eval run results for the current champion on the golden set. */
  championEvalResult: z.object({
    overallPassRate: z.number().min(0).max(1),
    mustNotRegressPassRate: z.number().min(0).max(1),
    totalCases: z.number().int().positive(),
    mustNotRegressCases: z.number().int().nonnegative(),
  }),
  /** Eval run results for the challenger on the same golden set. */
  challengerEvalResult: z.object({
    overallPassRate: z.number().min(0).max(1),
    mustNotRegressPassRate: z.number().min(0).max(1),
    totalCases: z.number().int().positive(),
    mustNotRegressCases: z.number().int().nonnegative(),
  }),
  /** Optional bias check — pass if stratification groups have consistent pass rates. */
  biasCheckPassed: z.boolean().optional(),
});
export type LE07Input = z.infer<typeof LE07Input>;

export const LE07Result = z.discriminatedUnion('status', [
  LEOutputBase.extend({
    status: z.literal('ok'),
    verdict: GatekeeperVerdict,
    /** Score delta (challenger minus champion). Positive means improvement. */
    scoreDelta: z.number(),
    mustNotRegressDelta: z.number(),
    /** The eval delta record to accompany the ratification surface (step 6). */
    evalDeltaSummary: z.string().min(1),
    evaluatedAt: z.string().datetime(),
  }),
  LEOutputBase.extend({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
    missingFields: z.array(z.string().min(1)).min(1),
  }),
]);
export type LE07Result = z.infer<typeof LE07Result>;

// ---------------------------------------------------------------------------
// LE-08 — Commons Publisher
// ---------------------------------------------------------------------------

/** Minimum distinct tenant count required for cross-school commons publication. */
export const COMMONS_K_ANONYMITY_THRESHOLD = 5 as const;

export const LE08Input = z.object({
  /** Publishing tenant's explicit opt-in flag. */
  tenantOptIn: z.boolean(),
  publishingTenantId: z.string().uuid(),
  pattern: MinedPattern,
  /** De-identified tenant references contributing to this pattern. */
  contributingTenantRefs: z.array(z.string().uuid()).min(1),
  /** The de-identified, aggregated form of the pattern for publication. */
  deidentifiedPayload: z.unknown(),
});
export type LE08Input = z.infer<typeof LE08Input>;

export const PublishedPattern = z.object({
  publishedPatternId: z.string().uuid(),
  patternId: z.string().uuid(),
  capsTopicId: z.string().min(1),
  agentId: z.string().min(1),
  effectSize: z.number(),
  confidenceInterval: z.tuple([z.number(), z.number()]),
  /** Number of contributing tenants — at least COMMONS_K_ANONYMITY_THRESHOLD. */
  contributingTenantCount: z.number().int().min(COMMONS_K_ANONYMITY_THRESHOLD),
  publishedAt: z.string().datetime(),
});
export type PublishedPattern = z.infer<typeof PublishedPattern>;

export const LE08Result = z.discriminatedUnion('status', [
  LEOutputBase.extend({
    status: z.literal('published'),
    publishedPattern: PublishedPattern,
  }),
  LEOutputBase.extend({
    status: z.literal('suppressed_below_threshold'),
    /** How many tenants contributed — always less than COMMONS_K_ANONYMITY_THRESHOLD. */
    contributingTenantCount: z.number().int().nonnegative(),
    required: z.literal(COMMONS_K_ANONYMITY_THRESHOLD),
    detail: z.string().min(1),
  }),
  LEOutputBase.extend({
    status: z.literal('suppressed_no_opt_in'),
    detail: z.string().min(1),
  }),
  LEOutputBase.extend({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
    missingFields: z.array(z.string().min(1)).min(1),
  }),
]);
export type LE08Result = z.infer<typeof LE08Result>;

// ---------------------------------------------------------------------------
// LE-09 — Decay & Revalidation Agent
// ---------------------------------------------------------------------------

export const DecayReason = z.enum([
  /** Pattern has exceeded its time-to-live and has not been revalidated. */
  'ttl_exceeded',
  /** A CAPS curriculum version change invalidated the topic the pattern was mined on. */
  'caps_version_change',
  /** An ATP pacing-plan update changed the delivery window the pattern depended on. */
  'atp_version_change',
  /** Revalidation eval run showed pattern no longer holds. */
  'revalidation_failed',
]);
export type DecayReason = z.infer<typeof DecayReason>;

export const LE09Input = z.object({
  tenantId: z.string().uuid(),
  pattern: MinedPattern,
  /** ISO-8601 datetime the pattern was last validated. */
  lastValidatedAt: z.string().datetime(),
  /** TTL in days after which revalidation is required. */
  ttlDays: z.number().int().positive(),
  /** Current CAPS curriculum version for the pattern's topic. Null if not versioned. */
  currentCapsVersion: z.string().min(1).nullable(),
  /** CAPS version the pattern was mined against. Null if not recorded. */
  patternCapsVersion: z.string().min(1).nullable(),
  /** Result of the revalidation eval run, if one was triggered. */
  revalidationResult: z
    .object({
      passRate: z.number().min(0).max(1),
      /** Minimum pass rate required to retain validity. */
      requiredPassRate: z.number().min(0).max(1),
    })
    .optional(),
  /** Today's date (ISO-8601 YYYY-MM-DD) — injected so the agent is deterministic. */
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type LE09Input = z.infer<typeof LE09Input>;

export const LE09Result = z.discriminatedUnion('status', [
  LEOutputBase.extend({
    status: z.literal('valid'),
    patternId: z.string().uuid(),
    daysUntilExpiry: z.number().int().nonnegative(),
  }),
  LEOutputBase.extend({
    status: z.literal('invalidated'),
    patternId: z.string().uuid(),
    reason: DecayReason,
    detail: z.string().min(1),
    invalidatedAt: z.string().datetime(),
  }),
  LEOutputBase.extend({
    status: z.literal('revalidation_required'),
    patternId: z.string().uuid(),
    reason: DecayReason,
    detail: z.string().min(1),
  }),
  LEOutputBase.extend({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
    missingFields: z.array(z.string().min(1)).min(1),
  }),
]);
export type LE09Result = z.infer<typeof LE09Result>;

// ---------------------------------------------------------------------------
// Promotion log — versioned record of every champion promotion
// ---------------------------------------------------------------------------

export const PromotionLogEntry = z.object({
  promotionId: z.string().uuid(),
  tenantId: z.string().uuid(),
  agentId: z.string().min(1),
  challengerId: z.string().uuid(),
  /** The prompt/exemplar version that was the champion before this promotion. */
  previousChampionVersion: z.string().min(1),
  /** The new champion version after promotion. */
  newChampionVersion: z.string().min(1),
  /** The eval delta that justified promotion (from LE-07). */
  evalDeltaSummary: z.string().min(1),
  /** Human who ratified the promotion (de-identified role + school context). */
  ratifiedBy: z.string().min(1),
  ratifiedAt: z.string().datetime(),
  promotedAt: z.string().datetime(),
});
export type PromotionLogEntry = z.infer<typeof PromotionLogEntry>;

// ---------------------------------------------------------------------------
// Maturity report — school's learning engine maturity level
// ---------------------------------------------------------------------------

export const MaturityLevel = z.enum([
  /** No corrections captured yet; engine has not started learning. */
  'cold_start',
  /** Corrections are being captured and patterns are being mined for this school. */
  'locally_calibrated',
  /** Patterns have been validated against real outcomes with evidence. */
  'evidence_led',
  /** Patterns are robust enough to contribute to cross-school commons. */
  'institutional',
]);
export type MaturityLevel = z.infer<typeof MaturityLevel>;

export const MaturityReport = z.object({
  tenantId: z.string().uuid(),
  maturityLevel: MaturityLevel,
  /** Edit rate: fraction of artefacts that required teacher edits. Lower is better over time. */
  editRate: z.number().min(0).max(1),
  /** First-pass acceptance rate: fraction approved without edits. Higher is better. */
  firstPassAcceptanceRate: z.number().min(0).max(1),
  /** Median minutes from artefact generation to teacher approval. */
  medianTimeToArtefactMinutes: z.number().nonnegative(),
  /** Mean score delta across all outcome-attributed patterns. Null if insufficient data. */
  meanOutcomeDelta: z.number().nullable(),
  /** Number of validated patterns in the school's local library. */
  validatedPatternCount: z.number().int().nonnegative(),
  /** Number of promoted exemplars in L3. */
  promotedExemplarCount: z.number().int().nonnegative(),
  generatedAt: z.string().datetime(),
});
export type MaturityReport = z.infer<typeof MaturityReport>;
