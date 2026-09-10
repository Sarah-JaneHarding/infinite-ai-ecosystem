// CE-06 Assessment Designer and CE-07 Rubric Builder contract types — Stage 08 step 3.
//
// CE-06 designs a formal or informal assessment task with a controlled spread across
// Bloom's cognitive levels, drawing all mark allocations from the assessment policy in L0.
// CE-07 takes that task and produces a rubric with four-level descriptors and a marking
// memo that markers can use directly.
//
// Assessment weightings and mark allocations come from policy in L0. Neither agent may
// compute or invent them — if the policy document is absent or unratified, both agents
// return needs_input.

import { z } from 'zod';

import { GradeLabel, SourceRef } from './framework.js';
import { CognitiveLevel } from './planning.js';

// ---------------------------------------------------------------------------
// CE-06 Assessment Designer
// ---------------------------------------------------------------------------

export const AssessmentTaskKind = z.enum([
  'test',
  'assignment',
  'project',
  'oral',
  'practical',
  'examination',
]);
export type AssessmentTaskKind = z.infer<typeof AssessmentTaskKind>;

export const CE06Input = z.object({
  grade: GradeLabel,
  subject: z.string().min(1),
  termNumber: z.number().int().min(1).max(4),
  taskKind: AssessmentTaskKind,
  academicYear: z.number().int().min(2000).max(2100),
  tenantId: z.string().uuid(),
});
export type CE06Input = z.infer<typeof CE06Input>;

export const CognitiveLevelSpread = z
  .object({
    knowledge: z.number().min(0).max(100),
    comprehension: z.number().min(0).max(100),
    application: z.number().min(0).max(100),
    analysis: z.number().min(0).max(100),
    synthesis: z.number().min(0).max(100),
    evaluation: z.number().min(0).max(100),
  })
  .refine(
    (s) =>
      Math.abs(
        s.knowledge +
          s.comprehension +
          s.application +
          s.analysis +
          s.synthesis +
          s.evaluation -
          100,
      ) < 0.01,
    { message: 'Cognitive level percentages must sum to 100.' },
  );
export type CognitiveLevelSpread = z.infer<typeof CognitiveLevelSpread>;

export const AssessmentQuestion = z.object({
  number: z.number().int().positive(),
  marks: z.number().int().positive(),
  cognitiveLevel: CognitiveLevel,
  source: SourceRef,
});
export type AssessmentQuestion = z.infer<typeof AssessmentQuestion>;

export const AssessmentSection = z.object({
  title: z.string().min(1),
  totalMarks: z.number().int().positive(),
  questions: z.array(AssessmentQuestion).min(1),
});
export type AssessmentSection = z.infer<typeof AssessmentSection>;

export const AssessmentTaskDesign = z.object({
  grade: GradeLabel,
  subject: z.string().min(1),
  termNumber: z.number().int().min(1).max(4),
  taskKind: AssessmentTaskKind,
  totalMarks: z.number().int().positive(),
  cognitiveSpread: CognitiveLevelSpread,
  sections: z.array(AssessmentSection).min(1),
  sourceDocuments: z.array(SourceRef).min(1),
  ratifiedAt: z.string().datetime().nullable(),
});
export type AssessmentTaskDesign = z.infer<typeof AssessmentTaskDesign>;

export const AssessmentDesignNeedsInput = z.object({
  status: z.literal('needs_input'),
  grade: GradeLabel,
  subject: z.string().min(1),
  missing: z
    .array(
      z.object({
        documentKind: z.enum([
          'GRADE_FRAMEWORK',
          'TERM_PLAN',
          'ASSESSMENT_POLICY',
          'CAPS_SUBJECT_STATEMENT',
        ]),
        detail: z.string().nullable(),
        why: z.string().min(1),
      }),
    )
    .min(1),
});
export type AssessmentDesignNeedsInput = z.infer<typeof AssessmentDesignNeedsInput>;

export const AssessmentTaskDesignResult = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), task: AssessmentTaskDesign }),
  AssessmentDesignNeedsInput,
]);
export type AssessmentTaskDesignResult = z.infer<typeof AssessmentTaskDesignResult>;

// ---------------------------------------------------------------------------
// CE-07 Rubric Builder
// ---------------------------------------------------------------------------

export const CE07Input = z.object({
  grade: GradeLabel,
  subject: z.string().min(1),
  taskKind: AssessmentTaskKind,
  tenantId: z.string().uuid(),
  totalMarks: z.number().int().positive(),
});
export type CE07Input = z.infer<typeof CE07Input>;

export const RubricDescriptors = z.object({
  level4: z.string().min(1),
  level3: z.string().min(1),
  level2: z.string().min(1),
  level1: z.string().min(1),
});
export type RubricDescriptors = z.infer<typeof RubricDescriptors>;

export const RubricCriterion = z.object({
  criterion: z.string().min(1),
  descriptors: RubricDescriptors,
  marks: z.number().int().positive(),
  source: SourceRef,
});
export type RubricCriterion = z.infer<typeof RubricCriterion>;

export const Rubric = z.object({
  grade: GradeLabel,
  subject: z.string().min(1),
  taskKind: AssessmentTaskKind,
  totalMarks: z.number().int().positive(),
  criteria: z.array(RubricCriterion).min(1),
  markingMemo: z.string().min(1),
  sourceDocuments: z.array(SourceRef).min(1),
  ratifiedAt: z.string().datetime().nullable(),
});
export type Rubric = z.infer<typeof Rubric>;

export const RubricNeedsInput = z.object({
  status: z.literal('needs_input'),
  grade: GradeLabel,
  subject: z.string().min(1),
  missing: z
    .array(
      z.object({
        documentKind: z.enum([
          'GRADE_FRAMEWORK',
          'ASSESSMENT_TASK_DESIGN',
          'ASSESSMENT_POLICY',
          'CAPS_SUBJECT_STATEMENT',
        ]),
        detail: z.string().nullable(),
        why: z.string().min(1),
      }),
    )
    .min(1),
});
export type RubricNeedsInput = z.infer<typeof RubricNeedsInput>;

export const RubricResult = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), rubric: Rubric }),
  RubricNeedsInput,
]);
export type RubricResult = z.infer<typeof RubricResult>;
