// The eval case format — Stage 07 step 1.
//
// "Define eval case format... source records whether the case came from a specification, a
// real human correction, or an incident." This is the one shape every golden-set case in
// this build is written to, the same "unknown plus a Zod parse" boundary (rule 8) every
// other contract in this codebase already uses. Step 2 (scorers) is what actually runs an
// `Expectation` against an agent's real output; this module only defines what a case, and
// what it expects, look like.
//
// `agentId` is declared as a plain validated string rather than cross-checked against a
// real `AgentContract` here — the same "declare now, verify once the owner exists" shape
// `AgentContract.evalSetRef` itself already uses, in the opposite direction. Step 3's
// runner is what actually resolves an agent id to a real registered agent.

import { z } from 'zod';

/** Where a case came from — "a specification, a real human correction, or an incident"
 * (step 1's own text). `correction` is what step 6's golden-set growth loop writes: a
 * human rejection or material edit at a HITL gate, de-identified and reviewed before it
 * becomes a case. */
export const EvalCaseSource = z.enum(['specification', 'correction', 'incident']);
export type EvalCaseSource = z.infer<typeof EvalCaseSource>;

/** Any Zod schema instance — the same `instanceof` check `packages/agents/src/contract.ts`
 * already uses for `inputSchema`/`outputSchema`, needed here for the `json_schema`
 * expectation's own schema. */
const ZodSchemaInstance = z.instanceof(z.ZodType, {
  message: 'must be a Zod schema instance',
});

/**
 * What one case checks for, keyed by which of step 2's named scorers it exercises. A case
 * may declare more than one expectation; the runner (step 3) scores every one and a case
 * passes only if all of them do. `llm_judge` reads its own instructions from the case's
 * top-level `rubric` — declaring the rubric text per expectation would let two judge
 * expectations on the same case disagree about what they are even grading.
 */
export const Expectation = z.discriminatedUnion('type', [
  /** The value at `field` (a dot path into the agent's output) equals `value` exactly. */
  z.object({
    type: z.literal('exact_match'),
    field: z.string().min(1),
    value: z.unknown(),
  }),
  /** The agent's whole output conforms to `schema`. */
  z.object({ type: z.literal('json_schema'), schema: ZodSchemaInstance }),
  /** The value at `field` is a number within `tolerance` of `expected`. */
  z.object({
    type: z.literal('numeric_tolerance'),
    field: z.string().min(1),
    expected: z.number(),
    tolerance: z.number().nonnegative(),
  }),
  /** The set of values at `field` overlaps `expectedSet` by at least `minOverlap` (a 0-1
   * fraction) — used for topic and code alignment, per step 2's own text. */
  z.object({
    type: z.literal('set_overlap'),
    field: z.string().min(1),
    expectedSet: z.array(z.string().min(1)).min(1),
    minOverlap: z.number().min(0).max(1),
  }),
  /** The output's Flesch-Kincaid grade level (`packages/guardrails`' own readability
   * check) falls within `[minGrade, maxGrade]`. */
  z.object({
    type: z.literal('readability_band'),
    minGrade: z.number(),
    maxGrade: z.number(),
  }),
  /** The output matches the structure `packages/guardrails`' own template-fidelity check
   * (OQ-015) enforces for `templateId`. */
  z.object({ type: z.literal('template_fidelity'), templateId: z.string().min(1) }),
  /** Every factual claim in the output cites a retrieved fact id or a CAPS clause — "the
   * grounding/citation check" (step 2's own text) — and at least `minCitations` are
   * present. */
  z.object({
    type: z.literal('citation_presence'),
    minCitations: z.number().int().positive(),
  }),
  /** The agent either must or must not refuse — and if it refuses, the refusal's own
   * `code` must equal `expectedReasonCode` when one is given. */
  z.object({
    type: z.literal('refusal_correctness'),
    shouldRefuse: z.boolean(),
    expectedReasonCode: z.string().min(1).optional(),
  }),
  /** The LLM-as-judge scorer (step 2), reading the case's own `rubric`, must score at
   * least `minScore` on `criterion` — a named dimension of the rubric (e.g. "tone",
   * "curriculum alignment") when the rubric scores more than one; omitted for a
   * single-dimension rubric. */
  z.object({
    type: z.literal('llm_judge'),
    minScore: z.number(),
    criterion: z.string().min(1).optional(),
  }),
]);
export type Expectation = z.infer<typeof Expectation>;

/**
 * The complete, runtime-checkable shape of one golden-set case — every field the manual's
 * own step 1 names, none defaulted. `input` and `context` are `unknown`: what an agent
 * actually receives is that agent's own `inputSchema` (Stage 06 step 1), which this
 * package does not have a route to re-derive without depending on every module that will
 * ever register one.
 */
export const EvalCase = z.object({
  /** Short, stable identifier — never reused for a different case, so a case's own score
   * history (step 8's dashboard) stays attributable across runs. */
  id: z.string().min(1),
  agentId: z.string().min(1),
  input: z.unknown(),
  /** Retrieved context, prior turns, or whatever else the agent's own prompt assembles
   * beyond `input` — opaque here for the same reason `input` is. */
  context: z.unknown(),
  expectations: z.array(Expectation).min(1),
  /** Free-text scoring guidance for the LLM-as-judge scorer. Optional: a case with no
   * `llm_judge` expectation has nothing for a rubric to instruct. */
  rubric: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)),
  source: EvalCaseSource,
});
export type EvalCase = z.infer<typeof EvalCase>;

/** The tag step 4's champion/challenger promotion treats as absolute: "a challenger is
 * promoted only if... it regresses no case tagged `must_not_regress`" (step 4's own text).
 * Exported as a named constant rather than left as a magic string every later step would
 * otherwise have to repeat correctly. */
export const MUST_NOT_REGRESS_TAG = 'must_not_regress';

/** The permanent safety set's own well-known tags (step 7's own text: "PII egress, prompt
 * injection, diagnosis-refusal, age-appropriateness, safeguarding escalation, cross-tenant
 * leakage") — run on every change regardless of what changed. Declared here, alongside the
 * rest of this format's vocabulary, though nothing yet filters on them; step 7 is what
 * does. */
export const SAFETY_TAGS = [
  'pii_egress',
  'prompt_injection',
  'diagnosis_refusal',
  'age_appropriateness',
  'safeguarding_escalation',
  'cross_tenant_leakage',
] as const;
export type SafetyTag = (typeof SAFETY_TAGS)[number];

export class EvalCaseError extends Error {
  public override readonly name = 'EvalCaseError';
  constructor(message: string) {
    super(message);
  }
}

/**
 * Parses and validates a candidate eval case. Throws with which field failed and why — the
 * same "unknown plus a Zod parse" boundary every other contract in this codebase uses,
 * rather than trusting a golden-set file's shape on faith.
 */
export function validateEvalCase(candidate: unknown): EvalCase {
  const result = EvalCase.safeParse(candidate);
  if (!result.success) {
    throw new EvalCaseError(`Eval case failed validation: ${result.error.message}`);
  }
  return result.data;
}
