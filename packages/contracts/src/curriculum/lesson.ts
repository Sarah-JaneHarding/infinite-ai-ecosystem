// CE-05 Lesson Plan Generator and CE-08 Differentiation Agent contract types — Stage 08 step 3.
//
// CE-05 generates a daily lesson plan for a teaching week, filling the school's approved
// template from the unit blueprint CE-04 produced. CE-08 takes a lesson plan and produces
// tier-aware variants for learners who need more support or greater challenge.
//
// Both agents are empty vessels until CE-04 output and template definitions exist in L0.
// Until then, every call returns needs_input naming what is missing.

import { z } from 'zod';

import { GradeLabel, SourceRef } from './framework.js';

// ---------------------------------------------------------------------------
// CE-05 Lesson Plan Generator
// ---------------------------------------------------------------------------

export const CE05Input = z.object({
  grade: GradeLabel,
  subject: z.string().min(1),
  weekNumber: z.number().int().positive(),
  termNumber: z.number().int().min(1).max(4),
  academicYear: z.number().int().min(2000).max(2100),
  tenantId: z.string().uuid(),
  templateId: z.string().min(1),
});
export type CE05Input = z.infer<typeof CE05Input>;

export const ActivityKind = z.enum(['introduction', 'development', 'consolidation']);
export type ActivityKind = z.infer<typeof ActivityKind>;

export const LessonActivity = z.object({
  kind: ActivityKind,
  description: z.string().min(1),
  durationMinutes: z.number().int().positive(),
});
export type LessonActivity = z.infer<typeof LessonActivity>;

export const Lesson = z.object({
  dayNumber: z.number().int().min(1).max(5),
  learningObjectives: z.array(z.string().min(1)).min(1),
  activities: z.array(LessonActivity).min(1),
  resources: z.array(z.string()),
  source: SourceRef,
});
export type Lesson = z.infer<typeof Lesson>;

export const LessonPlan = z.object({
  grade: GradeLabel,
  subject: z.string().min(1),
  weekNumber: z.number().int().positive(),
  termNumber: z.number().int().min(1).max(4),
  academicYear: z.number().int().min(2000),
  templateId: z.string().min(1),
  lessons: z.array(Lesson).min(1),
  sourceDocuments: z.array(SourceRef).min(1),
  ratifiedAt: z.string().datetime().nullable(),
});
export type LessonPlan = z.infer<typeof LessonPlan>;

export const LessonPlanNeedsInput = z.object({
  status: z.literal('needs_input'),
  grade: GradeLabel,
  subject: z.string().min(1),
  weekNumber: z.number().int().positive(),
  missing: z
    .array(
      z.object({
        documentKind: z.enum([
          'GRADE_FRAMEWORK',
          'UNIT_BLUEPRINT',
          'TEMPLATE_DEFINITION',
          'CAPS_SUBJECT_STATEMENT',
        ]),
        detail: z.string().nullable(),
        why: z.string().min(1),
      }),
    )
    .min(1),
});
export type LessonPlanNeedsInput = z.infer<typeof LessonPlanNeedsInput>;

export const LessonPlanResult = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), plan: LessonPlan }),
  LessonPlanNeedsInput,
]);
export type LessonPlanResult = z.infer<typeof LessonPlanResult>;

// ---------------------------------------------------------------------------
// CE-08 Differentiation Agent
// ---------------------------------------------------------------------------

export const DifferentiationTierName = z.enum(['support', 'on-level', 'extension']);
export type DifferentiationTierName = z.infer<typeof DifferentiationTierName>;

export const CE08Input = z.object({
  grade: GradeLabel,
  subject: z.string().min(1),
  weekNumber: z.number().int().positive(),
  termNumber: z.number().int().min(1).max(4),
  academicYear: z.number().int().min(2000).max(2100),
  tenantId: z.string().uuid(),
  tiers: z.array(DifferentiationTierName).min(1),
});
export type CE08Input = z.infer<typeof CE08Input>;

export const DifferentiatedTier = z.object({
  name: DifferentiationTierName,
  modifications: z.array(z.string().min(1)).min(1),
  scaffolds: z.array(z.string()),
  source: SourceRef,
});
export type DifferentiatedTier = z.infer<typeof DifferentiatedTier>;

export const DifferentiatedSet = z.object({
  grade: GradeLabel,
  subject: z.string().min(1),
  weekNumber: z.number().int().positive(),
  termNumber: z.number().int().min(1).max(4),
  academicYear: z.number().int().min(2000),
  tiers: z.array(DifferentiatedTier).min(1),
  sourceDocuments: z.array(SourceRef).min(1),
  ratifiedAt: z.string().datetime().nullable(),
});
export type DifferentiatedSet = z.infer<typeof DifferentiatedSet>;

export const DifferentiationNeedsInput = z.object({
  status: z.literal('needs_input'),
  grade: GradeLabel,
  subject: z.string().min(1),
  weekNumber: z.number().int().positive(),
  missing: z
    .array(
      z.object({
        documentKind: z.enum([
          'GRADE_FRAMEWORK',
          'LESSON_PLAN',
          'CAPS_SUBJECT_STATEMENT',
        ]),
        detail: z.string().nullable(),
        why: z.string().min(1),
      }),
    )
    .min(1),
});
export type DifferentiationNeedsInput = z.infer<typeof DifferentiationNeedsInput>;

export const DifferentiationResult = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), set: DifferentiatedSet }),
  DifferentiationNeedsInput,
]);
export type DifferentiationResult = z.infer<typeof DifferentiationResult>;
