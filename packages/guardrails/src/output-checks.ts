// The output side of the guardrail engine — Stage 06 step 6.
//
// "output: schema validation, grounding/citation check (every factual claim must cite a
// retrieved fact ID or a CAPS clause), template-fidelity check, readability check,
// age-appropriateness check, refusal-policy check, cost check." Seven checks; two of them
// — template fidelity and age-appropriateness — are real mechanisms with no built-in rule,
// not a silent pass dressed up as a check. Neither has a source this codebase can validate
// against yet: `docs/OPEN_QUESTIONS.md` OQ-003 already asks for the school's own artefact
// templates before template-fidelity can be built for real, and OQ-014 asks the same
// question for an age-appropriateness content policy — inventing either would be exactly
// the kind of unsourced policy rule 0.3 forbids. Both take an injected checker, the same
// "mechanism now, real check wired in once the source exists" shape
// `packages/agents/src/registry.ts` already uses for `promptExists`/`evalSetExists`, and
// default to passing when none is supplied — a documented gap, not a fake guarantee.

import type { z } from 'zod';

import { scoreReadability } from './readability.js';
import { PASSED, Refusal, refuse, type GuardrailVerdict } from './refusal.js';

/** Validates `output` against the agent's own declared `outputSchema`. */
export function checkOutputSchema(schema: z.ZodType, output: unknown): GuardrailVerdict {
  const result = schema.safeParse(output);
  if (result.success) return PASSED;
  return refuse(
    'invalid_output_schema',
    `Output failed schema validation: ${result.error.message}`,
  );
}

/**
 * "Every factual claim must cite a retrieved fact ID or a CAPS clause." Extracting claims
 * from free text is real NLP work this stage does not build; instead this check takes the
 * citation ids the agent's own structured output already declared (`citedIds` — a field
 * its `outputSchema` requires, a module concern) and the ids that were actually available
 * to cite for this call (retrieved-fact ids from `packages/brain`'s own
 * `RetrievalCandidate.id`, unioned with any `SourceRef.clause` reached for this call). It
 * refuses the first citation that does not resolve — a dangling citation, not a missing
 * one: an output with no citations at all is not itself refused here, since this check has
 * no way to know whether the output made any claims that needed one.
 */
export function checkGrounding(
  citedIds: readonly string[],
  validIds: ReadonlySet<string>,
): GuardrailVerdict {
  for (const id of citedIds) {
    if (!validIds.has(id)) {
      return refuse(
        'ungrounded_claim',
        `Citation "${id}" does not resolve to a retrieved fact or a CAPS clause reached ` +
          'for this call.',
      );
    }
  }
  return PASSED;
}

export type TemplateFidelityChecker = (output: unknown) => GuardrailVerdict;

/** See this module's header: no template is ratified yet (OQ-003), so with no `checker`
 * supplied this passes every output rather than refusing against a rule nobody wrote. */
export function checkTemplateFidelity(
  output: unknown,
  checker?: TemplateFidelityChecker,
): GuardrailVerdict {
  return checker === undefined ? PASSED : checker(output);
}

export interface ReadabilityRange {
  readonly minGrade: number;
  readonly maxGrade: number;
}

/** Scores `text` with `scoreReadability` and refuses outside `[minGrade, maxGrade]` — the
 * grade band a module declares appropriate for the audience it wrote for (a Grade 4 lesson
 * summary and a Grade 12 one do not share a target). */
export function checkReadability(
  text: string,
  range: ReadabilityRange,
): GuardrailVerdict {
  const { gradeLevel } = scoreReadability(text);
  if (gradeLevel < range.minGrade || gradeLevel > range.maxGrade) {
    return refuse(
      'readability_out_of_range',
      `Estimated grade level ${gradeLevel.toFixed(1)} is outside the target range ` +
        `[${range.minGrade}, ${range.maxGrade}].`,
    );
  }
  return PASSED;
}

export type AgeAppropriatenessChecker = (output: unknown) => GuardrailVerdict;

/** See this module's header: no content policy is supplied yet (OQ-014), so with no
 * `checker` supplied this passes every output rather than refusing against invented rules.*/
export function checkAgeAppropriateness(
  output: unknown,
  checker?: AgeAppropriatenessChecker,
): GuardrailVerdict {
  return checker === undefined ? PASSED : checker(output);
}

/**
 * Validates a claimed refusal's own shape. `claimedRefusal` is `null` when this call is not
 * a refusal at all, in which case there is nothing to check; otherwise it must parse as a
 * real `Refusal` — a reason code from the closed vocabulary, a non-empty user-facing
 * explanation, and (for a safeguarding concern) a real escalation route rather than a
 * refusal that only claims one.
 */
export function checkRefusalPolicy(claimedRefusal: unknown | null): GuardrailVerdict {
  if (claimedRefusal === null) return PASSED;
  const result = Refusal.safeParse(claimedRefusal);
  if (result.success) return PASSED;
  return refuse(
    'invalid_refusal',
    `Claimed refusal does not match the required shape: ${result.error.message}`,
  );
}

export interface CostBudget {
  readonly maxCostUsd: number;
}

export function checkCost(actualCostUsd: number, budget: CostBudget): GuardrailVerdict {
  if (actualCostUsd > budget.maxCostUsd) {
    return refuse(
      'cost_budget_exceeded',
      `Actual cost $${actualCostUsd.toFixed(4)} exceeds this agent's own budget of ` +
        `$${budget.maxCostUsd.toFixed(4)}.`,
    );
  }
  return PASSED;
}
