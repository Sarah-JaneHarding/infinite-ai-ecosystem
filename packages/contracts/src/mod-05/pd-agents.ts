// PD agent input/output schemas — Stage 12 steps 2–5.
//
// PD-01 Coverage vs Pacing Analyst — deterministic; no model call for the computation itself.
// PD-02 Assessment Quality Analyst — psychometrics computed from AssessmentSignal data.
// PD-03 Observation Analyst — model call to synthesise themes from WalkthroughNotes.
// PD-04 Practice Signal Aggregator — aggregates all four signal types to a PD need profile.
// PD-05 PD Gap Detector — identifies priority gaps from the aggregated need profile.
// PD-06 Micro-Course Composer — composes a 20–40 minute structured learning object.
// PD-07 Coaching Plan Agent — produces a coaching conversation plan for the human coach.
// PD-08 CPTD Tracker — logs CPTD points against a school's supplied policy (never computed).
//
// Cross-cutting constraints enforced at the schema level:
//
// 1. No rankings: no PD output carries a teacher rank, percentile, or ordinal position relative
//    to peers. The `no_ranking` status is not needed because the schemas structurally exclude
//    ranking fields — there is nowhere to put one.
// 2. Suppression: any comparative or aggregate output includes either a real result or a
//    CohortSuppressionResult. A result below MINIMUM_COHORT_SIZE must use the suppressed path.
// 3. CPTD values: PD-08 reads point values from a supplied L0 policy document. It never
//    computes CPTD points; it only records what the policy says.
// 4. Developmental framing: none of these schemas carry a "score" for the teacher as an
//    individual. Outputs are patterns, themes, plans, and courses — not evaluations.

import { z } from 'zod';

import { GradeLabel } from '../curriculum/framework.js';
import { CohortSuppressionResult } from './signals.js';

// ---------------------------------------------------------------------------
// Shared fragments
// ---------------------------------------------------------------------------

const PDOutputBase = z.object({
  tenantId: z.string().uuid(),
  generatedAt: z.string().datetime(),
});

const NeedsInput = z.object({
  status: z.literal('needs_input'),
  detail: z.string().min(1),
  missingFields: z.array(z.string().min(1)).min(1),
});

// ---------------------------------------------------------------------------
// PD-01 — Coverage vs Pacing Analyst
// ---------------------------------------------------------------------------

export const PD01Input = z.object({
  tenantId: z.string().uuid(),
  subject: z.string().min(1),
  gradeLabel: GradeLabel,
  /** ISO-8601 date range for the analysis window. */
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** CoverageSignals for this subject/grade in the period. Min 1 required. */
  coverageSignals: z.array(z.unknown()).min(1),
});
export type PD01Input = z.infer<typeof PD01Input>;

export const TopicGap = z.object({
  capsTopicId: z.string().min(1),
  deliveryStatus: z.enum(['not_delivered', 'partially_delivered']),
  weeksBehind: z.number().int().nonnegative(),
});

export const PD01Result = z.discriminatedUnion('status', [
  PDOutputBase.extend({
    status: z.literal('ok'),
    subject: z.string().min(1),
    gradeLabel: GradeLabel,
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    topicsAnalysed: z.number().int().nonnegative(),
    topicsOnTrack: z.number().int().nonnegative(),
    topicsBehind: z.number().int().nonnegative(),
    topicsAhead: z.number().int().nonnegative(),
    /** Mean weeks behind schedule across all behind-schedule topics. 0 when none. */
    meanWeeksDrift: z.number(),
    /** Topics requiring attention, ordered by weeks behind descending. */
    gapTopics: z.array(TopicGap),
    /** Plain-language summary of the pacing situation. No ranking language. */
    summary: z.string().min(1),
  }),
  NeedsInput,
]);
export type PD01Result = z.infer<typeof PD01Result>;

// ---------------------------------------------------------------------------
// PD-02 — Assessment Quality Analyst
// ---------------------------------------------------------------------------

export const PD02Input = z.object({
  tenantId: z.string().uuid(),
  assessmentSignals: z.array(z.unknown()).min(1),
  /** If provided, filter analysis to this topic. */
  capsTopicId: z.string().min(1).optional(),
  gradeLabel: GradeLabel.optional(),
});
export type PD02Input = z.infer<typeof PD02Input>;

/** Item count per Bloom's revised level across the analysed assessment items. */
export const PD02CognitiveLevelCounts = z.object({
  remember: z.number().int().nonnegative(),
  understand: z.number().int().nonnegative(),
  apply: z.number().int().nonnegative(),
  analyse: z.number().int().nonnegative(),
  evaluate: z.number().int().nonnegative(),
  create: z.number().int().nonnegative(),
});
export type PD02CognitiveLevelCounts = z.infer<typeof PD02CognitiveLevelCounts>;

/** A single item flagged for quality concerns. */
export const FlaggedItem = z.object({
  itemId: z.string().min(1),
  concern: z.enum([
    'low_difficulty',
    'high_difficulty',
    'poor_discrimination',
    'negative_discrimination',
    'low_marking_consistency',
  ]),
  value: z.number(),
  /** Brief explanation of the concern. */
  detail: z.string().min(1),
});
export type FlaggedItem = z.infer<typeof FlaggedItem>;

export const PD02Result = z.discriminatedUnion('status', [
  PDOutputBase.extend({
    status: z.literal('ok'),
    itemsAnalysed: z.number().int().positive(),
    meanDifficulty: z.number().min(0).max(1),
    meanDiscrimination: z.number().min(-1).max(1),
    meanMarkingConsistency: z.number().min(0).max(1),
    cognitiveLevelCounts: PD02CognitiveLevelCounts,
    flaggedItems: z.array(FlaggedItem),
    /** Plain-language summary. No ranking language; no comparison between teachers. */
    summary: z.string().min(1),
  }),
  NeedsInput,
]);
export type PD02Result = z.infer<typeof PD02Result>;

// ---------------------------------------------------------------------------
// PD-03 — Observation Analyst
// ---------------------------------------------------------------------------

export const PD03Input = z.object({
  tenantId: z.string().uuid(),
  /** Walkthrough notes to synthesise. All teacher refs must be anonymised. */
  walkthroughNotes: z.array(z.unknown()).min(1),
  /** Optional: restrict synthesis to a single focus area. */
  focus: z
    .enum([
      'curriculum_alignment',
      'pedagogy',
      'learner_engagement',
      'assessment_practice',
      'classroom_management',
      'language_of_instruction',
    ])
    .optional(),
  sourceDocumentIds: z.array(z.string().min(1)).optional(),
});
export type PD03Input = z.infer<typeof PD03Input>;

export const ObservationTheme = z.object({
  theme: z.string().min(1),
  /** Observation focus areas that support this theme. */
  supportingFoci: z.array(z.string().min(1)).min(1),
  evidenceStrength: z.enum(['emerging', 'consistent', 'strong']),
  /** Concrete examples from the notes. No teacher names; de-identified. */
  illustrativeExamples: z.array(z.string().min(1)).min(1),
});
export type ObservationTheme = z.infer<typeof ObservationTheme>;

export const PD03Result = z.discriminatedUnion('status', [
  PDOutputBase.extend({
    status: z.literal('ok'),
    notesAnalysed: z.number().int().positive(),
    themes: z.array(ObservationTheme).min(1),
    /** Priority areas for PD support, in order of urgency. */
    priorityAreas: z.array(z.string().min(1)).min(1),
    summary: z.string().min(1),
    citedSourceIds: z.array(z.string().min(1)).optional(),
  }),
  NeedsInput,
]);
export type PD03Result = z.infer<typeof PD03Result>;

// ---------------------------------------------------------------------------
// PD-04 — Practice Signal Aggregator
// ---------------------------------------------------------------------------

export const PD04Input = z.object({
  tenantId: z.string().uuid(),
  /** All four signal types may be present; at least one required. */
  signals: z.array(z.unknown()).min(1),
  /** Cohort size for suppression check — must be counted before aggregation. */
  cohortSize: z.number().int().nonnegative(),
  subject: z.string().min(1).optional(),
  gradeLabel: GradeLabel.optional(),
});
export type PD04Input = z.infer<typeof PD04Input>;

export const PDNeedArea = z.object({
  area: z.string().min(1),
  signalSources: z
    .array(z.enum(['coverage', 'assessment', 'walkthrough', 'artefact_edit']))
    .min(1),
  urgency: z.enum(['low', 'medium', 'high']),
  evidenceSummary: z.string().min(1),
});
export type PDNeedArea = z.infer<typeof PDNeedArea>;

export const PD04Result = z.discriminatedUnion('status', [
  PDOutputBase.extend({
    status: z.literal('ok'),
    signalsAggregated: z.number().int().positive(),
    cohortSize: z.number().int().positive(),
    needAreas: z.array(PDNeedArea).min(1),
    summary: z.string().min(1),
  }),
  CohortSuppressionResult,
  NeedsInput,
]);
export type PD04Result = z.infer<typeof PD04Result>;

// ---------------------------------------------------------------------------
// PD-05 — PD Gap Detector
// ---------------------------------------------------------------------------

export const PD05Input = z.object({
  tenantId: z.string().uuid(),
  /** Output from PD-04 (serialised as unknown to avoid circular imports). */
  needProfile: z.unknown(),
  /** Available PD interventions from the school's L3 exemplars. */
  availableInterventions: z.array(z.string().min(1)).optional(),
});
export type PD05Input = z.infer<typeof PD05Input>;

export const PriorityGap = z.object({
  area: z.string().min(1),
  urgency: z.enum(['low', 'medium', 'high']),
  rationale: z.string().min(1),
  suggestedInterventionType: z.enum([
    'micro_course',
    'coaching_cycle',
    'peer_observation',
    'resource_provision',
  ]),
});
export type PriorityGap = z.infer<typeof PriorityGap>;

export const PD05Result = z.discriminatedUnion('status', [
  PDOutputBase.extend({
    status: z.literal('ok'),
    priorityGaps: z.array(PriorityGap).min(1),
    /** Top-priority gap for immediate action. */
    topPriorityGap: PriorityGap,
    summary: z.string().min(1),
  }),
  NeedsInput,
]);
export type PD05Result = z.infer<typeof PD05Result>;

// ---------------------------------------------------------------------------
// PD-06 — Micro-Course Composer
// ---------------------------------------------------------------------------

export const PD06Input = z.object({
  tenantId: z.string().uuid(),
  gap: z.unknown(),
  /** L3 exemplars and school evidence to ground the course content. */
  sourceDocumentIds: z.array(z.string().min(1)).min(1),
  /** Target duration in minutes: 20–40. */
  targetDurationMinutes: z.number().int().min(20).max(40),
  language: z.string().min(2).max(5),
});
export type PD06Input = z.infer<typeof PD06Input>;

export const MicroCourseModule = z.object({
  title: z.string().min(1),
  type: z.enum(['input', 'model', 'deliberate_practice', 'check_for_understanding']),
  /** Estimated duration in minutes. */
  estimatedMinutes: z.number().int().positive(),
  content: z.string().min(1),
  /** Materials or resources needed. */
  materials: z.array(z.string().min(1)),
});
export type MicroCourseModule = z.infer<typeof MicroCourseModule>;

export const PD06Result = z.discriminatedUnion('status', [
  PDOutputBase.extend({
    status: z.literal('ok'),
    courseId: z.string().uuid(),
    title: z.string().min(1),
    targetGap: z.string().min(1),
    totalEstimatedMinutes: z.number().int().min(20).max(40),
    modules: z.array(MicroCourseModule).min(1),
    /** Check-for-understanding items to confirm learning. */
    checkItems: z.array(z.string().min(1)).min(1),
    citedSourceIds: z.array(z.string().min(1)).min(1),
    /** Exported as a structured learning object (JSON). Not a PDF or binary. */
    exportable: z.literal(true),
  }),
  NeedsInput,
]);
export type PD06Result = z.infer<typeof PD06Result>;

// ---------------------------------------------------------------------------
// PD-07 — Coaching Plan Agent
// ---------------------------------------------------------------------------

export const PD07Input = z.object({
  tenantId: z.string().uuid(),
  gap: z.unknown(),
  /** Reference to the micro-course produced by PD-06, if available. */
  courseId: z.string().uuid().optional(),
  /** Number of coaching sessions to plan for. */
  sessionCount: z.number().int().min(1).max(6),
  sourceDocumentIds: z.array(z.string().min(1)).min(1),
  language: z.string().min(2).max(5),
});
export type PD07Input = z.infer<typeof PD07Input>;

export const CoachingSession = z.object({
  sessionNumber: z.number().int().positive(),
  focus: z.string().min(1),
  /** Suggested conversation starters for the human coach. */
  openingPrompts: z.array(z.string().min(1)).min(1),
  /** Evidence points the coach should reference. */
  evidencePoints: z.array(z.string().min(1)).min(1),
  /** Suggested follow-up observation focus. */
  observationFocus: z.string().min(1).optional(),
  estimatedMinutes: z.number().int().positive(),
});
export type CoachingSession = z.infer<typeof CoachingSession>;

export const PD07Result = z.discriminatedUnion('status', [
  PDOutputBase.extend({
    status: z.literal('ok'),
    planId: z.string().uuid(),
    targetGap: z.string().min(1),
    sessions: z.array(CoachingSession).min(1),
    /** Overarching coaching goal statement. */
    goalStatement: z.string().min(1),
    citedSourceIds: z.array(z.string().min(1)).min(1),
  }),
  NeedsInput,
]);
export type PD07Result = z.infer<typeof PD07Result>;

// ---------------------------------------------------------------------------
// PD-08 — CPTD Tracker
// ---------------------------------------------------------------------------

export const PD08Input = z.object({
  tenantId: z.string().uuid(),
  /** Opaque anonymised teacher reference. */
  teacherRef: z.string().min(1),
  /** Activity that may qualify for CPTD points. */
  activityType: z.enum([
    'micro_course_completion',
    'coaching_cycle_completion',
    'peer_observation',
    'formal_workshop',
    'self_directed_study',
    'mentoring',
  ]),
  /** Duration of the activity in minutes — used to look up points from L0 policy. */
  durationMinutes: z.number().int().positive(),
  completedAt: z.string().datetime(),
  /** L0 policy document IDs from which CPTD point values are read. */
  policyDocumentIds: z.array(z.string().min(1)).min(1),
});
export type PD08Input = z.infer<typeof PD08Input>;

export const PD08Result = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    teacherRef: z.string().min(1),
    activityType: z.string().min(1),
    /** Points awarded — read from L0 policy, never computed by the model. */
    pointsAwarded: z.number().nonnegative(),
    /** The policy clause that authorises these points. */
    policyReference: z.string().min(1),
    /** L0 document ID the point value was read from. */
    citedPolicyDocumentId: z.string().min(1),
    loggedAt: z.string().datetime(),
    /** Running CPTD total for this teacher in the current cycle. */
    cycleTotal: z.number().nonnegative(),
  }),
  z.object({
    status: z.literal('no_policy_match'),
    detail: z.string().min(1),
    activityType: z.string().min(1),
  }),
  NeedsInput,
]);
export type PD08Result = z.infer<typeof PD08Result>;
