// CE-03 Term Planner and CE-04 Unit Architect contract types — Stage 08 step 3.
//
// CE-03 translates an ATPSchedule into a per-term plan for each subject: which content
// areas run in which teaching weeks, and when assessment tasks fall. CE-04 takes a content
// area from that plan and produces a backward-design blueprint — big ideas, success
// criteria, and the evidence that will demonstrate mastery.
//
// Both agents are empty vessels until their source documents are ratified into L0 — see
// docs/SOURCE_DOCUMENTS.md. Until then, every call returns needs_input naming what is
// missing, which is the correct and expected behaviour.

import { z } from 'zod';

import { GradeLabel, SourceRef, Sourced } from './framework.js';
import { WeekKind } from './atp.js';

// ---------------------------------------------------------------------------
// CE-03 Term Planner
// ---------------------------------------------------------------------------

export const CE03Input = z.object({
  grade: GradeLabel,
  subjects: z.array(z.string().min(1)).min(1),
  termNumber: z.number().int().min(1).max(4),
  academicYear: z.number().int().min(2000).max(2100),
  tenantId: z.string().uuid(),
});
export type CE03Input = z.infer<typeof CE03Input>;

export const TermPlanWeekEntry = z.object({
  weekNumber: z.number().int().positive(),
  contentArea: z.string().min(1),
  topics: z.array(z.string().min(1)).min(1),
  kind: WeekKind,
  source: SourceRef,
});
export type TermPlanWeekEntry = z.infer<typeof TermPlanWeekEntry>;

export const TermAssessmentTask = z.object({
  subjectName: z.string().min(1),
  taskKind: z.string().min(1),
  weekNumber: z.number().int().positive(),
  source: SourceRef,
});
export type TermAssessmentTask = z.infer<typeof TermAssessmentTask>;

export const TermPlanSubject = z.object({
  subjectName: z.string().min(1),
  weeks: z.array(TermPlanWeekEntry).min(1),
});
export type TermPlanSubject = z.infer<typeof TermPlanSubject>;

export const TermPlan = z.object({
  grade: GradeLabel,
  termNumber: z.number().int().min(1).max(4),
  academicYear: z.number().int().min(2000),
  subjects: z.array(TermPlanSubject).min(1),
  assessmentCalendar: z.array(TermAssessmentTask),
  sourceDocuments: z.array(SourceRef).min(1),
  ratifiedAt: z.string().datetime().nullable(),
});
export type TermPlan = z.infer<typeof TermPlan>;

export const TermPlanNeedsInput = z.object({
  status: z.literal('needs_input'),
  grade: GradeLabel,
  termNumber: z.number().int().min(1).max(4),
  missing: z
    .array(
      z.object({
        documentKind: z.enum([
          'GRADE_FRAMEWORK',
          'ATP_SCHEDULE',
          'ASSESSMENT_POLICY',
          'CAPS_SUBJECT_STATEMENT',
        ]),
        subjectName: z.string().nullable(),
        why: z.string().min(1),
      }),
    )
    .min(1),
});
export type TermPlanNeedsInput = z.infer<typeof TermPlanNeedsInput>;

export const TermPlanResult = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), plan: TermPlan }),
  TermPlanNeedsInput,
]);
export type TermPlanResult = z.infer<typeof TermPlanResult>;

// ---------------------------------------------------------------------------
// CE-04 Unit Architect
// ---------------------------------------------------------------------------

export const CE04Input = z.object({
  grade: GradeLabel,
  subject: z.string().min(1),
  termNumber: z.number().int().min(1).max(4),
  contentArea: z.string().min(1),
  academicYear: z.number().int().min(2000).max(2100),
  tenantId: z.string().uuid(),
});
export type CE04Input = z.infer<typeof CE04Input>;

export const CognitiveLevel = z.enum([
  'knowledge',
  'comprehension',
  'application',
  'analysis',
  'synthesis',
  'evaluation',
]);
export type CognitiveLevel = z.infer<typeof CognitiveLevel>;

export const SuccessCriterion = z.object({
  criterion: z.string().min(1),
  cognitiveLevel: CognitiveLevel,
  source: SourceRef,
});
export type SuccessCriterion = z.infer<typeof SuccessCriterion>;

export const EvidenceItem = z.object({
  kind: z.enum(['formal', 'informal']),
  description: z.string().min(1),
  source: SourceRef,
});
export type EvidenceItem = z.infer<typeof EvidenceItem>;

export const UnitBlueprint = z.object({
  grade: GradeLabel,
  subject: z.string().min(1),
  contentArea: z.string().min(1),
  termNumber: z.number().int().min(1).max(4),
  bigIdeas: z.array(Sourced(z.string().min(1))).min(1),
  successCriteria: z.array(SuccessCriterion).min(1),
  evidence: z.array(EvidenceItem).min(1),
  sourceDocuments: z.array(SourceRef).min(1),
  ratifiedAt: z.string().datetime().nullable(),
});
export type UnitBlueprint = z.infer<typeof UnitBlueprint>;

export const UnitNeedsInput = z.object({
  status: z.literal('needs_input'),
  grade: GradeLabel,
  subject: z.string().min(1),
  contentArea: z.string().min(1),
  missing: z
    .array(
      z.object({
        documentKind: z.enum(['GRADE_FRAMEWORK', 'TERM_PLAN', 'CAPS_SUBJECT_STATEMENT']),
        subjectName: z.string().nullable(),
        why: z.string().min(1),
      }),
    )
    .min(1),
});
export type UnitNeedsInput = z.infer<typeof UnitNeedsInput>;

export const UnitBlueprintResult = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), blueprint: UnitBlueprint }),
  UnitNeedsInput,
]);
export type UnitBlueprintResult = z.infer<typeof UnitBlueprintResult>;

// ---------------------------------------------------------------------------
// Teacher-facing Unit Plan Document (Section 1–7 of the CAPS Unit Blueprint form)
// ---------------------------------------------------------------------------
// This is the domain type for the teacher-completed planning document — the form the
// teacher fills in, stored per-unit per-term. It is distinct from `UnitBlueprint`, which
// is the AI-generated backward-design artefact produced by CE-04. A teacher fills in a
// UnitPlanDocument; CE-04 generates a UnitBlueprint. Both concern the same unit of work
// but serve different consumers.

/** One row of the Scope, Sequence and Learning Plan table (Section 5). */
export const UnitPlanLessonRow = z.object({
  lessonDay: z.string().min(1),
  coreObjective: z.string().min(1),
  teacherActivities: z.string().min(1),
  learnerActivities: z.string().min(1),
  resources: z.string(),
});
export type UnitPlanLessonRow = z.infer<typeof UnitPlanLessonRow>;

/** Teacher's self-reported ATP coverage status (Section 7). */
export const CoverageStatus = z.enum(['on_track', 'behind', 'ahead']);
export type CoverageStatus = z.infer<typeof CoverageStatus>;

/**
 * The full teacher-completed CAPS Unit Blueprint document. All seven sections are
 * represented; the reflection section is nullable because it is completed after teaching.
 * `tenantId` is required because this document is a tenant-owned planning record stored in
 * L3 under the RLS policy — a document without a tenant is not storable.
 */
export const UnitPlanDocument = z.object({
  tenantId: z.string().uuid(),

  // Section 1 — Administrative & Contextual Details
  schoolName: z.string().min(1),
  district: z.string().min(1),
  subject: z.string().min(1),
  grade: GradeLabel,
  termNumber: z.number().int().min(1).max(4),
  weekFrom: z.number().int().positive(),
  weekTo: z.number().int().positive(),
  unitTitle: z.string().min(1),
  timeAllocation: z.string().min(1),

  // Section 2 — Curriculum Alignment (CAPS)
  capsTopicSubtopic: z.string().min(1),
  coreConcepts: z.string().min(1),
  skillsToDevelop: z.string().min(1),

  // Section 3 — Learning Objectives (three cognitive tiers)
  objectiveLow: z.string().min(1),
  objectiveMedium: z.string().min(1),
  objectiveHigh: z.string().min(1),

  // Section 4 — Assessment Strategy
  formativeAssessment: z.string().min(1),
  formalAssessmentTask: z.string().min(1),
  enrichment: z.string().nullable(),
  remediation: z.string().nullable(),

  // Section 5 — Scope, Sequence & Learning Plan
  lessons: z.array(UnitPlanLessonRow).min(1),

  // Section 6 — LTSM (nullable fields = unused resource type)
  ltsmApprovedTextbooks: z.string().nullable(),
  ltsmDbeWorkbooks: z.string().nullable(),
  ltsmPosters: z.boolean(),
  ltsmDigital: z.boolean(),

  // Section 7 — Teacher Reflection (null until post-teaching)
  coverageStatus: CoverageStatus.nullable(),
  gapsIdentified: z.string().nullable(),
  interventionPlan: z.string().nullable(),
  successesAndImprovements: z.string().nullable(),

  // Template traceability
  templateId: z.string().min(1),
  academicYear: z.number().int().min(2000).max(2100),
});
export type UnitPlanDocument = z.infer<typeof UnitPlanDocument>;
