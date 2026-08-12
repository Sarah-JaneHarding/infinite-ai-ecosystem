// MOD-05 Teaching Signal model — Stage 12 step 1.
//
// The four teaching-signal types that feed MOD-05 agents are defined here. Each
// signal type carries a `signalType` discriminator so callers can narrow the union,
// and every signal is identified by a tenant-scoped ID and a UTC ISO-8601 timestamp.
//
// Data provenance:
//   CoverageSignal   ← MOD-01 planned vs delivered curriculum tracking (L2 write-path)
//   AssessmentSignal ← MOD-03 item analysis computed from submitted learner responses
//   WalkthroughNote  ← PD-03 structured observation input (teacher-facing, never learner PII)
//   ArtefactEditRate ← MOD-04 TeacherEditSignal aggregated to a per-topic edit rate
//
// All teacher identifiers entering these signals are de-identified (cohort-level or
// anonymised) at the aggregation layer (PD-04) before any comparative view renders.
// None of these schemas carry a real teacher name, email, or staff number — the
// `teacherRef` field is an opaque anonymised cohort token, never a natural key.

import { z } from 'zod';

import { GradeLabel } from '../curriculum/framework.js';

// ---------------------------------------------------------------------------
// Shared fragments
// ---------------------------------------------------------------------------

const SignalBase = z.object({
  tenantId: z.string().uuid(),
  signalId: z.string().uuid(),
  capturedAt: z.string().datetime(),
});

// ---------------------------------------------------------------------------
// CoverageSignal — curriculum pacing and topic delivery
// ---------------------------------------------------------------------------

export const TopicDeliveryStatus = z.enum([
  'delivered',
  'partially_delivered',
  'not_delivered',
  'ahead_of_plan',
]);
export type TopicDeliveryStatus = z.infer<typeof TopicDeliveryStatus>;

export const CoverageSignal = SignalBase.extend({
  signalType: z.literal('coverage'),
  capsTopicId: z.string().min(1),
  gradeLabel: GradeLabel,
  subject: z.string().min(1),
  /** The week the topic was planned. ISO-8601 date (YYYY-MM-DD). */
  plannedWeek: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Null when the topic has not been delivered yet. */
  deliveredWeek: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  deliveryStatus: TopicDeliveryStatus,
  /** Weeks behind (<0) or ahead (>0) of plan. 0 means on time or not yet due. */
  weeksDrift: z.number().int(),
});
export type CoverageSignal = z.infer<typeof CoverageSignal>;

// ---------------------------------------------------------------------------
// AssessmentSignal — psychometric item quality from MOD-03
// ---------------------------------------------------------------------------

/** Item difficulty (p-value): 0 = all wrong, 1 = all right. */
const DifficultyIndex = z.number().min(0).max(1);

/**
 * Item discrimination (point-biserial correlation): -1 to 1.
 * Items below 0.2 are flagged; items below 0 are invalid.
 */
const DiscriminationIndex = z.number().min(-1).max(1);

export const AssessmentItemSignal = z.object({
  itemId: z.string().min(1),
  difficultyIndex: DifficultyIndex,
  discriminationIndex: DiscriminationIndex,
  /** Proportion of markers who assigned the same mark (inter-rater, 0–1). */
  markingConsistency: z.number().min(0).max(1),
  cognitiveLevel: z.enum([
    'remember',
    'understand',
    'apply',
    'analyse',
    'evaluate',
    'create',
  ]),
});
export type AssessmentItemSignal = z.infer<typeof AssessmentItemSignal>;

export const AssessmentSignal = SignalBase.extend({
  signalType: z.literal('assessment'),
  assessmentId: z.string().min(1),
  capsTopicId: z.string().min(1),
  gradeLabel: GradeLabel,
  subject: z.string().min(1),
  /** Number of learners whose responses contributed to this signal. */
  cohortSize: z.number().int().positive(),
  items: z.array(AssessmentItemSignal).min(1),
});
export type AssessmentSignal = z.infer<typeof AssessmentSignal>;

// ---------------------------------------------------------------------------
// WalkthroughNote — structured observation input for PD-03
// ---------------------------------------------------------------------------

/** Top-level observation foci from the structured walkthrough instrument. */
export const WalkthroughFocus = z.enum([
  'curriculum_alignment',
  'pedagogy',
  'learner_engagement',
  'assessment_practice',
  'classroom_management',
  'language_of_instruction',
]);
export type WalkthroughFocus = z.infer<typeof WalkthroughFocus>;

export const WalkthroughNote = SignalBase.extend({
  signalType: z.literal('walkthrough'),
  /** Opaque anonymised cohort token. Never a natural teacher identifier. */
  teacherRef: z.string().min(1),
  observationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gradeLabel: GradeLabel,
  subject: z.string().min(1),
  focus: WalkthroughFocus,
  /** Free-text observer notes — de-identified before entry. No learner PII. */
  notes: z.string().min(1),
  /** Observer-assigned evidence strength: 1 (weak) to 4 (strong). */
  evidenceStrength: z.number().int().min(1).max(4),
});
export type WalkthroughNote = z.infer<typeof WalkthroughNote>;

// ---------------------------------------------------------------------------
// ArtefactEditRate — MOD-04 teacher-correction signal aggregated per topic
// ---------------------------------------------------------------------------

export const ArtefactEditRate = SignalBase.extend({
  signalType: z.literal('artefact_edit'),
  capsTopicId: z.string().min(1),
  agentId: z.string().min(1),
  artefactType: z.string().min(1),
  /** Total artefacts generated for this topic in the window. */
  totalArtefacts: z.number().int().nonnegative(),
  /** Artefacts that received at least one teacher edit before delivery. */
  editedArtefacts: z.number().int().nonnegative(),
  /** Mean proportion of characters changed across edited artefacts (0–1). */
  meanEditDepth: z.number().min(0).max(1),
  /** ISO-8601 date of start of aggregation window. */
  windowStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  windowEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type ArtefactEditRate = z.infer<typeof ArtefactEditRate>;

// ---------------------------------------------------------------------------
// TeachingSignal — discriminated union of all four signal types
// ---------------------------------------------------------------------------

export const TeachingSignal = z.discriminatedUnion('signalType', [
  CoverageSignal,
  AssessmentSignal,
  WalkthroughNote,
  ArtefactEditRate,
]);
export type TeachingSignal = z.infer<typeof TeachingSignal>;

// ---------------------------------------------------------------------------
// CohortSuppressionResult — returned instead of comparative output when
// the cohort falls below the minimum size threshold
// ---------------------------------------------------------------------------

export const CohortSuppressionResult = z.object({
  status: z.literal('suppressed'),
  reason: z.literal('cohort_below_minimum'),
  minimumRequired: z.number().int().positive(),
  actual: z.number().int().nonnegative(),
  detail: z.string().min(1),
});
export type CohortSuppressionResult = z.infer<typeof CohortSuppressionResult>;

/** The minimum cohort size below which any comparative aggregate is suppressed. */
export const MINIMUM_COHORT_SIZE = 5 as const;
