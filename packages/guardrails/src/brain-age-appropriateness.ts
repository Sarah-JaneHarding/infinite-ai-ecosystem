// A real `AgeAppropriatenessChecker`, grounded in the age-appropriateness clauses ingested
// into L0 — the remaining half of OQ-015 this package's own header names (see
// output-checks.ts). What this file does NOT do: invent a way to decide whether a piece of
// content is developmentally appropriate. The 206 ingested clauses
// (`@infinite-ai/contracts`' `AGE_APPROPRIATENESS_ENTRIES`) are descriptive developmental
// principles ("content moves from simple to complex across a phase"), not a wordlist or a
// pass/fail rule a mechanical comparison could apply — turning them into a verdict on
// arbitrary agent output is exactly the kind of judgment call rule 0.3 says not to
// fabricate. So this checker does the honest half — retrieving the real, ratified clauses
// for the phase in question through the same `recall()` every other Brain read goes
// through — and defers the actual judgment to an injected `AgeAppropriatenessJudge`, the
// same "mechanism now, real caller wires the model call later" shape
// `packages/evals/src/scorers.ts`'s own `LlmJudge` already uses for the same reason (see
// its header and OQ-016): a model call has to go through the Model Gateway (rule 3), which
// needs its own prompt version, eval set and cost budget (rule 9) — a new agent, not
// something this package can stand up unilaterally.
//
// Deliberately not wired into `apps/worker`'s default `StepExecutorDeps` /
// `WorkerHostDeps`: this checker needs a `CapsPhase` to know which of the 206 clauses are
// even relevant, and nothing in the generic agent-call path (`PipelineJobData`,
// `StepExecutionContext.input: unknown`) carries one — no agent contract declares a grade
// or phase field today. Guessing a field name out of an arbitrary agent's own output shape
// would be inventing a convention, the same thing this file already declines to do for the
// judgment itself. A specific pipeline that already knows its own phase (e.g. a MOD-01
// curriculum-planning pipeline) can construct this checker directly and pass it through
// `WorkerHostDeps.ageAppropriatenessChecker` — the injection point already exists and takes
// effect with no other code change, exactly as `step-executor.ts`'s own comments describe.

import type { AgeAppropriatenessSourceEntry, CapsPhase } from '@infinite-ai/contracts';
import { recall, selectAgeAppropriatenessEntries } from '@infinite-ai/brain';
import type { TenantClient } from '@infinite-ai/db';
import type { Actor, Resource } from '@infinite-ai/policy';

import type { AgeAppropriatenessChecker } from './output-checks.js';
import { PASSED, refuse, type GuardrailVerdict } from './refusal.js';

/**
 * The guardrail engine's own system actor for this one read — not a real staff member.
 * RBAC still gates the read (rule 5: every Brain read goes through the tenant-scoped
 * client, and `recall()`'s own policy gate authorizes every actor regardless of caller), so
 * this needs *some* real `Actor` with a real grant, not a bypass. Scoped to exactly what
 * this check needs — an `smt` grant is the least-broad existing role with tenant-wide
 * `lesson_plan` read (`packages/policy/src/rbac.ts`) — and nothing else. The same "fixed,
 * documented system identity, least privilege for its one job" shape
 * `packages/db/prisma/seed.ts`'s own `SEED_ACTOR` already uses for a different mechanical
 * task.
 */
const GUARDRAIL_SYSTEM_ACTOR = '00000000-0000-4000-8000-00000009a2d1';

/**
 * Renders a verdict on `output` given the real, ratified age-appropriateness clauses
 * retrieved for its phase — an injected async function, not built here, for the same
 * reason `LlmJudge` isn't (see this module's own header). A real implementation calls the
 * Model Gateway (rule 3); nothing in this package may do that itself.
 */
export type AgeAppropriatenessJudge = (
  clauses: readonly AgeAppropriatenessSourceEntry[],
  output: unknown,
) => Promise<{ readonly appropriate: boolean; readonly rationale: string }>;

/**
 * Builds an `AgeAppropriatenessChecker` that retrieves the ratified `AGE_APPROPRIATENESS`
 * clauses for `phase` from L0 (via `recall()`, the same read path every other Brain
 * consumer uses — no second way to reach ratified policy) and, when `judge` is supplied,
 * asks it to render a verdict grounded in those real clauses. With no `judge` supplied,
 * this passes every output — retrieving real clauses without a real judge to interpret
 * them is not itself a reason to refuse, the same honesty every other check in
 * `output-checks.ts` already holds to when its policy input is missing.
 */
export function createBrainAgeAppropriatenessChecker(
  tx: TenantClient,
  tenantId: string,
  phase: CapsPhase,
  judge?: AgeAppropriatenessJudge,
): AgeAppropriatenessChecker {
  return async (output: unknown): Promise<GuardrailVerdict> => {
    const actor: Actor = {
      userId: GUARDRAIL_SYSTEM_ACTOR,
      tenantId,
      grants: [
        {
          role: 'smt',
          schoolId: null,
          classGroupId: null,
          subjectId: null,
          expiresAt: null,
        },
      ],
      guardianOfLearnerIds: [],
      impersonating: false,
    };
    const resource: Resource = {
      type: 'lesson_plan',
      tenantId,
      schoolId: null,
      classGroupId: null,
      subjectId: null,
      learnerId: null,
      ownerId: null,
    };
    const result = await recall(tx, {
      actor,
      resource,
      purpose: 'planning',
      subject: null,
      entityTypeHints: null,
      queryEmbedding: null,
      vectorK: 0,
      graphHops: 0,
      episodicWindow: null,
      episodicSubjectNodeId: null,
      tokenBudget: 50_000,
      now: new Date(),
    });
    const clauses = selectAgeAppropriatenessEntries(result.candidates, { phase });

    if (judge === undefined) return PASSED;

    const verdict = await judge(clauses, output);
    if (verdict.appropriate) return PASSED;
    return refuse('age_inappropriate', verdict.rationale);
  };
}
