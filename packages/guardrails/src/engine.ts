// The guardrail engine's composition — Stage 06 step 6.
//
// "Composable checks running before and after every agent call." `input-checks.ts` and
// `output-checks.ts` are the composable pieces; this module is what actually runs each
// side's fixed pipeline in order and stops at the first refusal — the same "gates in a
// fixed order, first failure wins" shape `packages/policy/src/access.ts`'s own three-gate
// order already established for purpose/consent, applied here across every check this
// stage builds. `AgentContract.guardrails` (step 1) names additional checks a specific
// agent runs beyond this fixed set; resolving those names to real functions is a stated
// follow-up for whichever module first declares one — there is nothing to resolve yet.
//
// A trace span wraps each phase (Definition of Done: "emits a trace span"); an
// audit-ledger entry is deliberately not written here — this package has no dependency on
// `@infinite-ai/db`, and nothing yet calls this engine at a point where a tenant
// transaction is already open to append one into. That wiring belongs to whichever call
// site first invokes a real agent (Stage 06's own agent runtime integration, not yet
// built), the same "mechanism now, real caller later" shape this stage has used
// throughout (see `docs/STAGE_LOG.md`).

import { NOOP_TRACER, type Tracer } from '@infinite-ai/telemetry';
import type { DataCategory } from '@infinite-ai/contracts';
import type { AccessRequest } from '@infinite-ai/policy';
import type { TenantLexicon } from '@infinite-ai/deident';
import type { z } from 'zod';

import {
  checkInputSchema,
  checkPii,
  checkPromptInjection,
  checkPurposeAndConsent,
  checkTokenBudget,
  type TokenBudget,
} from './input-checks.js';
import type { EgressPayload } from './pii-guard.js';
import {
  checkAgeAppropriateness,
  checkCost,
  checkGrounding,
  checkOutputSchema,
  checkReadability,
  checkRefusalPolicy,
  checkTemplateFidelity,
  type AgeAppropriatenessChecker,
  type CostBudget,
  type ReadabilityRange,
  type TemplateFidelityChecker,
} from './output-checks.js';
import {
  PASSED,
  type EscalationRoute,
  type GuardrailVerdict,
  type Refusal,
} from './refusal.js';

/**
 * Notified synchronously, and awaited, the moment a refusal carries an escalation route —
 * "pages a named human immediately and never queues" made structural: there is no queue,
 * no worker, nothing to enqueue onto. `defaultEscalationNotifier` is deliberately not a
 * silent no-op; see this file's own export for why.
 */
export type EscalationNotifier = (
  route: EscalationRoute,
  refusal: Refusal,
) => void | Promise<void>;

export class GuardrailEscalationError extends Error {
  public override readonly name = 'GuardrailEscalationError';
  constructor(message: string) {
    super(message);
  }
}

/**
 * No real paging integration (SMS, phone, PagerDuty) is available in this build — it needs
 * a third-party account this environment does not have (`docs/OPEN_QUESTIONS.md` OQ-014).
 * A silent no-op here would be worse than the gap it papers over: a safeguarding
 * escalation that "succeeded" without reaching anyone. This throws instead, loudly, so a
 * deployment that has not yet wired a real notifier finds out at the moment it would
 * matter, not after.
 */
export const defaultEscalationNotifier: EscalationNotifier = (route, refusal) => {
  throw new GuardrailEscalationError(
    `Escalation required (category "${route.category}", role "${route.notifyRole}") but ` +
      `no real notifier is configured — see docs/OPEN_QUESTIONS.md OQ-014. ` +
      `Refusal: ${refusal.explanation}`,
  );
};

async function maybeEscalate(
  verdict: GuardrailVerdict,
  notify: EscalationNotifier,
): Promise<GuardrailVerdict> {
  if (verdict.passed || verdict.refusal.escalation === null) return verdict;
  await notify(verdict.refusal.escalation, verdict.refusal);
  return verdict;
}

export interface GuardrailRunOptions {
  readonly tracer?: Tracer;
  readonly notify?: EscalationNotifier;
}

export interface InputGuardrailInput {
  readonly inputSchema: z.ZodType;
  readonly input: unknown;
  readonly access: AccessRequest;
  readonly requiredCategories: readonly DataCategory[];
  readonly egress: EgressPayload;
  readonly lexicon: TenantLexicon;
  readonly tokenBudget: TokenBudget;
}

/** Runs every input check in the manual's own order, stopping at the first refusal. */
export async function runInputGuardrails(
  input: InputGuardrailInput,
  options: GuardrailRunOptions = {},
): Promise<GuardrailVerdict> {
  const tracer = options.tracer ?? NOOP_TRACER;
  const notify = options.notify ?? defaultEscalationNotifier;
  const span = tracer.startSpan('guardrails.input');
  try {
    const checks: readonly (readonly [string, () => GuardrailVerdict])[] = [
      ['schema', () => checkInputSchema(input.inputSchema, input.input)],
      [
        'purpose_and_consent',
        () => checkPurposeAndConsent(input.access, input.requiredCategories),
      ],
      ['pii', () => checkPii(input.egress, input.lexicon)],
      ['prompt_injection', () => checkPromptInjection(input.egress.texts)],
      ['token_budget', () => checkTokenBudget(input.egress.texts, input.tokenBudget)],
    ];
    for (const [name, run] of checks) {
      const verdict = run();
      span.addEvent(`guardrail.${name}`, { passed: verdict.passed });
      if (!verdict.passed) return await maybeEscalate(verdict, notify);
    }
    return PASSED;
  } finally {
    span.end();
  }
}

export interface OutputGuardrailInput {
  readonly outputSchema: z.ZodType;
  readonly output: unknown;
  readonly citedIds: readonly string[];
  readonly validCitationIds: ReadonlySet<string>;
  readonly readabilityText: string;
  readonly readabilityRange: ReadabilityRange;
  readonly actualCostUsd: number;
  readonly costBudget: CostBudget;
  /** `null` when this call is not itself a refusal — see `checkRefusalPolicy`. */
  readonly claimedRefusal: unknown | null;
  readonly templateFidelityChecker?: TemplateFidelityChecker;
  readonly ageAppropriatenessChecker?: AgeAppropriatenessChecker;
}

/** Runs every output check in the manual's own order, stopping at the first refusal. */
export async function runOutputGuardrails(
  input: OutputGuardrailInput,
  options: GuardrailRunOptions = {},
): Promise<GuardrailVerdict> {
  const tracer = options.tracer ?? NOOP_TRACER;
  const notify = options.notify ?? defaultEscalationNotifier;
  const span = tracer.startSpan('guardrails.output');
  try {
    const checks: readonly (readonly [string, () => GuardrailVerdict])[] = [
      ['schema', () => checkOutputSchema(input.outputSchema, input.output)],
      ['grounding', () => checkGrounding(input.citedIds, input.validCitationIds)],
      [
        'template_fidelity',
        () => checkTemplateFidelity(input.output, input.templateFidelityChecker),
      ],
      [
        'readability',
        () => checkReadability(input.readabilityText, input.readabilityRange),
      ],
      [
        'age_appropriateness',
        () => checkAgeAppropriateness(input.output, input.ageAppropriatenessChecker),
      ],
      ['refusal_policy', () => checkRefusalPolicy(input.claimedRefusal)],
      ['cost', () => checkCost(input.actualCostUsd, input.costBudget)],
    ];
    for (const [name, run] of checks) {
      const verdict = run();
      span.addEvent(`guardrail.${name}`, { passed: verdict.passed });
      if (!verdict.passed) return await maybeEscalate(verdict, notify);
    }
    return PASSED;
  } finally {
    span.end();
  }
}
