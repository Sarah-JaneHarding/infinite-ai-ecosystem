// Answer-key verification contract — Stage 11 step 1.
//
// "Answer keys are verified by a separate correctness pass (a second agent solving the
// items independently and comparing) before the teacher sees them. Disagreement blocks
// release and flags the item." — TB-05 Memo & Marking Guide Agent.
//
// The verifier agent (the "second agent") receives the same question stem the author agent
// received but not the author's answer. It returns its own answer independently. This
// contract is the shape both agents agree on, and what the comparison step produces.

import { z } from 'zod';

/** One item in an answer key, with both the author's and verifier's answers recorded. */
export const AnswerKeyItem = z.object({
  itemId: z.string().min(1),
  question: z.string().min(1),
  /** The answer produced by the memo/marking-guide author (TB-05). */
  authorAnswer: z.string().min(1),
  /** The answer produced by the independent verifier. */
  verifierAnswer: z.string().min(1),
  /** True when both answers are substantively equivalent. */
  agrees: z.boolean(),
});
export type AnswerKeyItem = z.infer<typeof AnswerKeyItem>;

/**
 * The result of comparing all items in the answer key.
 *
 * `verified` — every item agrees; the memo may proceed to teacher review.
 * `disagreement` — at least one item disagrees; the memo is blocked from release and
 * every flagged item is listed so the teacher can adjudicate.
 */
export const AnswerKeyVerificationResult = z.discriminatedUnion('verdict', [
  z.object({
    verdict: z.literal('verified'),
    items: z.array(AnswerKeyItem).min(1),
  }),
  z.object({
    verdict: z.literal('disagreement'),
    flaggedItems: z.array(AnswerKeyItem).min(1),
    allItems: z.array(AnswerKeyItem).min(1),
  }),
]);
export type AnswerKeyVerificationResult = z.infer<typeof AnswerKeyVerificationResult>;
