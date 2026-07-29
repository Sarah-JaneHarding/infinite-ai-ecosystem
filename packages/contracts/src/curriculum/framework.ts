// The curriculum framework contract — the shape a grade's curriculum takes once CAPS is
// ingested, and the structure CE-01 and CE-02 populate in Stage 08.
//
// The central design decision here is that **every policy-derived number carries its
// source, and the type system will not let you omit it**. A time allocation or an
// assessment weighting cannot be constructed without a `SourceRef` naming the document,
// its version and the clause it came from.
//
// This is deliberate and it is the whole point of the file. The manual forbids agents
// inventing weightings and mark allocations, and forbids synthesising curriculum. A rule
// like that survives exactly as long as it is easier to follow than to break. Making the
// citation a required field means the lazy path and the correct path are the same path:
// you cannot express an uncited allocation, so nobody has to remember not to.
//
// Nothing in this file contains an actual CAPS value. The schemas are empty vessels until
// the source documents are ingested (see docs/SOURCE_DOCUMENTS.md).

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

/**
 * Where a policy value came from.
 *
 * `explain()` has to be able to trace any generated artefact back to a clause in a
 * specific version of a specific document. That chain starts here: if a value enters the
 * system without a SourceRef, the chain is broken at its root and no amount of downstream
 * care repairs it.
 */
export const SourceRef = z.object({
  /** Stable id of the ingested document in L0, e.g. `caps-ip-mathematics-gr4-6`. */
  documentId: z.string().min(1),
  /** The document's own published version or revision date, not our ingest date. */
  documentVersion: z.string().min(1),
  /**
   * The clause, section or table this value was read from, e.g. `§2.3, Table 2.1`.
   * Free text because CAPS documents are not uniformly numbered, but never empty: a
   * citation of "the document" is not a citation.
   */
  clause: z.string().min(1),
  /** Page in the source PDF, where known. Makes human verification a ten-second job. */
  page: z.number().int().positive().optional(),
  /** Who ratified this extraction into L0. Null until a human has signed it off. */
  ratifiedBy: z.string().nullable(),
});
export type SourceRef = z.infer<typeof SourceRef>;

/** Wraps any value with the citation that justifies it. */
export const Sourced = <T extends z.ZodTypeAny>(value: T) =>
  z.object({ value, source: SourceRef });

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

/**
 * The four CAPS phases.
 *
 * Phase membership is structural rather than a policy number — a school knows which phase
 * Grade 7 sits in — so it is enumerated here. Everything a phase *contains* still comes
 * from the documents.
 */
export const Phase = z.enum(['FOUNDATION', 'INTERMEDIATE', 'SENIOR', 'FET']);
export type Phase = z.infer<typeof Phase>;

/** Grade R through 12. `R` is reception year and does not sort numerically. */
export const GradeLabel = z.enum([
  'R',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
]);
export type GradeLabel = z.infer<typeof GradeLabel>;

/**
 * Instructional time for one subject in one grade.
 *
 * Both figures are sourced independently because CAPS states them differently across
 * phases — some tables give hours per week, others periods per cycle — and silently
 * converting between them is a way to introduce an error that looks like arithmetic.
 */
export const TimeAllocation = z.object({
  /** Hours of instruction per week, as stated in policy. */
  hoursPerWeek: Sourced(z.number().positive()),
  /**
   * Periods per timetable cycle, where policy expresses it that way. Optional because not
   * every phase does — absent means "policy did not state it", never "we did not look".
   */
  periodsPerCycle: Sourced(z.number().int().positive()).optional(),
  /** Notes from the source: conditions, exceptions, phase-specific provisos. */
  conditions: z.array(z.string()).default([]),
});
export type TimeAllocation = z.infer<typeof TimeAllocation>;

/**
 * How a subject's marks are composed.
 *
 * `components` must sum to 100 — checked, not assumed. A weighting table that does not
 * total 100 is a transcription error, and catching it at ingestion is far cheaper than
 * discovering it in a report card.
 */
export const AssessmentWeighting = z
  .object({
    components: z
      .array(
        z.object({
          /** e.g. "School-Based Assessment", "End-of-year examination". */
          name: z.string().min(1),
          percentage: Sourced(z.number().min(0).max(100)),
        }),
      )
      .min(1),
    /** Number of formal assessment tasks required, per policy. */
    formalTasksPerYear: Sourced(z.number().int().nonnegative()).optional(),
  })
  .refine(
    (w) => {
      const total = w.components.reduce((sum, c) => sum + c.percentage.value, 0);
      return Math.abs(total - 100) < 0.01;
    },
    {
      message:
        'Assessment components must sum to 100%. A total that does not is a transcription error.',
    },
  );
export type AssessmentWeighting = z.infer<typeof AssessmentWeighting>;

/** One subject as it appears in one grade. */
export const SubjectFramework = z.object({
  subjectName: z.string().min(1),
  /** CAPS subject code where the document states one. */
  capsCode: z.string().nullable(),
  time: TimeAllocation,
  assessment: AssessmentWeighting,
  /**
   * Topic and content areas, populated by CE-01 from the subject statement. Empty until
   * ingestion — deliberately not pre-filled with plausible-looking topics.
   */
  contentAreas: z
    .array(
      z.object({
        name: z.string().min(1),
        /** Weighting of this content area within the subject, where policy states one. */
        weighting: Sourced(z.number().min(0).max(100)).optional(),
        source: SourceRef,
      }),
    )
    .default([]),
});
export type SubjectFramework = z.infer<typeof SubjectFramework>;

/**
 * The curriculum framework for a single grade.
 *
 * `totalInstructionalHours` is sourced rather than summed from the subjects. CAPS states a
 * phase total, and it is not always the arithmetic sum of the parts — computing it would
 * quietly paper over a discrepancy that a human should see.
 */
export const GradeFramework = z
  .object({
    grade: GradeLabel,
    phase: Phase,
    totalInstructionalHours: Sourced(z.number().positive()),
    subjects: z.array(SubjectFramework).min(1),
    /** Set when a human has ratified this framework into L0. Null blocks publication. */
    ratifiedAt: z.string().datetime().nullable(),
  })
  .superRefine((framework, ctx) => {
    const summed = framework.subjects.reduce((t, s) => t + s.time.hoursPerWeek.value, 0);
    const stated = framework.totalInstructionalHours.value;
    // Surfaced as a warning-shaped issue rather than silently reconciled: a mismatch
    // between the stated phase total and the sum of subjects is exactly the kind of thing
    // a Head of Department should adjudicate, not something code should average away.
    if (Math.abs(summed - stated) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['totalInstructionalHours'],
        message:
          `Subject hours sum to ${summed} but policy states ${stated}. ` +
          'This may be correct — some phases allocate flexible time — but it must be ' +
          'confirmed against the source rather than reconciled automatically.',
      });
    }
  });
export type GradeFramework = z.infer<typeof GradeFramework>;

/** The full framework for a school, one entry per grade it offers. */
export const CurriculumFramework = z.object({
  tenantId: z.string().uuid(),
  academicYear: z.number().int(),
  grades: z.array(GradeFramework).min(1),
  /** Every document this framework was derived from, for audit. */
  sourceDocuments: z.array(SourceRef).min(1),
});
export type CurriculumFramework = z.infer<typeof CurriculumFramework>;

/**
 * The result of asking for a framework that cannot yet be built.
 *
 * CE-01's prompt contract requires a `needs_input` result naming exactly what is missing,
 * rather than a best-effort framework. This is that result, typed — so "we do not have the
 * document" is a first-class outcome the UI can render, not an error to be swallowed or a
 * gap to be filled in with something plausible.
 */
export const FrameworkNeedsInput = z.object({
  status: z.literal('needs_input'),
  grade: GradeLabel,
  missing: z
    .array(
      z.object({
        documentKind: z.enum(['CAPS_SUBJECT_STATEMENT', 'ATP', 'ASSESSMENT_POLICY']),
        subjectName: z.string().nullable(),
        why: z.string().min(1),
      }),
    )
    .min(1),
});
export type FrameworkNeedsInput = z.infer<typeof FrameworkNeedsInput>;

export const FrameworkResult = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), framework: GradeFramework }),
  FrameworkNeedsInput,
]);
export type FrameworkResult = z.infer<typeof FrameworkResult>;
