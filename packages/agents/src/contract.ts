// The Agent contract — Stage 06 step 1.
//
// "Every agent in this system is built to this standard. No exceptions, no 'quick'
// agents." (manual Part 3). This is that standard made concrete: one shape every agent —
// in every module, in every later stage — declares completely, and one Zod schema that
// checks a candidate against it at runtime, the same "unknown plus a Zod parse" pattern
// (rule 8) every other boundary in this codebase already uses. `AgentRegistry` (step 2)
// is what turns a failed check into a boot failure rather than a warning; this module only
// defines what "valid" means.
//
// Three fields reference a subsystem this stage builds later, or a different stage
// entirely, and are declared here as plain validated strings rather than cross-checked for
// real existence yet — the same "declare now, verify once the owner exists" shape Stage 05
// already used for `retentionRuleId` and `dataCategory`:
//   - `promptRef` — step 3's Prompt Registry is what will confirm a referenced prompt
//     version actually exists and is content-hashed; here it is only shape-validated
//     (an agent id and a semver string).
//   - `guardrails` — step 6's Guardrail Engine is what defines the real set of check names
//     and runs them; here each name is only checked for being a non-empty string.
//   - `evalSetRef` — Stage 07 (Eval harness) is what an eval set actually lives in and gets
//     verified against; here it is only checked for being a non-empty identifier.

import { LogicalModel, Purpose } from '@infinite-ai/contracts';
import { z } from 'zod';

/**
 * `MOD-01`..`MOD-05` exist today; `MOD-06` and beyond are a real, anticipated extension
 * point (manual §5.2: "a new module... must supply its own agent set"), so this validates
 * the *shape* of a module id rather than checking it against a closed list — the same
 * reasoning `LogicalModel`'s own "domain.action" pattern already gives for logical model
 * names it cannot yet enumerate either. `LE` is Stage 13's Learning Engine, the one agent
 * owner in the manual that is not itself a numbered `MOD-`.
 */
export const AgentModule = z
  .string()
  .regex(/^(MOD-\d{2}|LE)$/, 'module must be "MOD-NN" or "LE"');
export type AgentModule = z.infer<typeof AgentModule>;

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const SEMVER_MESSAGE = 'version must be a semver string (x.y.z)';

/**
 * Which prompt version an agent was built and evaluated against — never a bare string.
 * Prompts cannot be edited in place (Part 3.2 rule 6: "editing a prompt in place is a CI
 * failure"), so a contract that only named an agent id without a version could silently
 * start running against a different prompt the moment a new version shipped.
 */
export const PromptRef = z.object({
  agent: z.string().min(1),
  version: z.string().regex(SEMVER_PATTERN, SEMVER_MESSAGE),
});
export type PromptRef = z.infer<typeof PromptRef>;

/**
 * A tool's side-effect classification (step 7). `irreversible` always requires a human
 * gate — enforced against a pipeline's own tool-call steps (step 4's `dag.ts`) by step 7's
 * `validatePipelineGating`, not here; this schema only records which classification a
 * declared tool carries.
 */
export const ToolSideEffect = z.enum(['read', 'write', 'external', 'irreversible']);
export type ToolSideEffect = z.infer<typeof ToolSideEffect>;

/** Any Zod schema instance — used for `inputSchema`/`outputSchema` fields whose own shape
 * this contract cannot know in advance, only that a real schema was actually supplied. */
const ZodSchemaInstance = z.instanceof(z.ZodType, {
  message: 'must be a Zod schema instance',
});

/**
 * A tool's own declaration (step 7): a Zod input schema, a purpose, an idempotency policy
 * and a side-effect classification. Exported under the same name as its inferred type —
 * the same dual declaration `AgentContract` and `PromptRef` already use in this file —
 * because step 7's own `ToolRegistry` validates a candidate tool standalone, not only as
 * part of an agent's own `tools` array.
 */
export const ToolDeclaration = z.object({
  name: z.string().min(1),
  purpose: z.string().min(1),
  /** The tool's own input contract — validated the same way an agent's `inputSchema` is,
   * never trusted free-form. */
  inputSchema: ZodSchemaInstance,
  idempotent: z.boolean(),
  sideEffect: ToolSideEffect,
});
export type ToolDeclaration = z.infer<typeof ToolDeclaration>;

/**
 * A ceiling on what a *single run* of this agent may cost — the agent author's own
 * declared sanity bound, part of the contract every agent ships with (CLAUDE.md's
 * Definition of Done: "adds an agent → ... and a cost budget"). Distinct from
 * `apps/gateway/src/budgets/budget.ts`'s `BudgetLimits`: that is a tenant's own
 * configurable daily/monthly aggregate spend limit, checked at the gateway; this is a
 * fixed property of the agent's own definition, checked per call.
 */
const AgentBudgetSchema = z.object({
  maxTokens: z.number().int().positive(),
  maxCostUsd: z.number().positive(),
});
export type AgentBudget = z.infer<typeof AgentBudgetSchema>;

/**
 * The complete, runtime-checkable shape of an agent contract. `z.infer` on this is the
 * type every agent's contract module (`packages/agents/src/<module>/<id>.contract.ts`,
 * per Part 3.3) is built to — every field required, none defaulted, so a contract missing
 * one fails `AgentContract.safeParse` rather than compiling with a silent gap.
 */
export const AgentContract = z.object({
  /** Short, stable identifier — e.g. `"CE-05"`. Never reused for a different agent. */
  id: z.string().min(1),
  version: z.string().regex(SEMVER_PATTERN, SEMVER_MESSAGE),
  module: AgentModule,
  purpose: Purpose,
  inputSchema: ZodSchemaInstance,
  outputSchema: ZodSchemaInstance,
  promptRef: PromptRef,
  /** A logical model name (e.g. `"plan.author"`) — never a concrete provider model. The
   * Model Gateway (Stage 04) is the only thing that resolves it further; there is no
   * second path to a provider from an agent's own contract. */
  model: LogicalModel,
  tools: z.array(ToolDeclaration),
  /** Guardrail check names this agent runs, beyond whatever the engine (step 6) already
   * applies to every agent unconditionally. */
  guardrails: z.array(z.string().min(1)),
  budget: AgentBudgetSchema,
  evalSetRef: z.string().min(1),
  requiresApproval: z.boolean(),
  writesToBrain: z.boolean(),
});
export type AgentContract = z.infer<typeof AgentContract>;

export class AgentContractError extends Error {
  public override readonly name = 'AgentContractError';
  constructor(message: string) {
    super(message);
  }
}

/**
 * Parses and validates a candidate agent contract. Throws with which field failed and why
 * — "an agent that omits any field fails to register" (step 1's own text) made concrete;
 * `AgentRegistry` (step 2) is what calls this for every agent it tries to register and
 * turns the throw into a boot failure rather than a warning.
 */
export function validateAgentContract(candidate: unknown): AgentContract {
  const result = AgentContract.safeParse(candidate);
  if (!result.success) {
    throw new AgentContractError(
      `Agent contract failed validation: ${result.error.message}`,
    );
  }
  return result.data;
}
