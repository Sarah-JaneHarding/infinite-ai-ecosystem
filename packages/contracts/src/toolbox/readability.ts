// Readability check contract — Stage 11 step 1.
//
// "Reading level is measured, not estimated: run a readability metric appropriate to the
// language and assert the grade band. Out of band is a hard failure."
//
// This contract defines what the readability check API expects and returns. The actual
// metric (Flesch-Kincaid for English, equivalent measures for other official languages)
// is implemented in the package that owns the check; this contract only records what
// "in band" or "out of band" means, so every TB agent that emits learner-facing text
// can be checked against the same schema.
//
// `cannot_measure` exists for languages where no validated metric is available yet.
// TB-06 (Home-Language Adapter) marks those languages as `human-review-required` rather
// than shipping them with an unchecked reading level (Stage 11 step 3).

import { z } from 'zod';

/** A grade-level range for a school phase. Both bounds are inclusive. */
export const GradeBand = z
  .object({
    minGrade: z.number(),
    maxGrade: z.number(),
  })
  .superRefine((band, ctx) => {
    if (band.maxGrade < band.minGrade) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxGrade'],
        message: `maxGrade (${band.maxGrade}) must be >= minGrade (${band.minGrade}).`,
      });
    }
  });
export type GradeBand = z.infer<typeof GradeBand>;

export const ReadabilityCheckInput = z.object({
  text: z.string().min(1),
  targetBand: GradeBand,
  /** ISO 639-1 language code, e.g. "en", "af", "zu", "xh". */
  language: z.string().min(2).max(5),
});
export type ReadabilityCheckInput = z.infer<typeof ReadabilityCheckInput>;

export const ReadabilityCheckResult = z.discriminatedUnion('verdict', [
  z.object({
    verdict: z.literal('within_band'),
    measuredGrade: z.number(),
    targetBand: GradeBand,
  }),
  z.object({
    verdict: z.literal('below_band'),
    measuredGrade: z.number(),
    targetBand: GradeBand,
  }),
  z.object({
    verdict: z.literal('above_band'),
    measuredGrade: z.number(),
    targetBand: GradeBand,
  }),
  z.object({
    verdict: z.literal('cannot_measure'),
    language: z.string(),
    reason: z.string().min(1),
  }),
]);
export type ReadabilityCheckResult = z.infer<typeof ReadabilityCheckResult>;
