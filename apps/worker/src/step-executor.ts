// The StepExecutor implementation — the bridge between the orchestrator's DAG runner and
// the real work each step does.
//
// agent_call: load the agent's prompt → POST to the Model Gateway →
//   parse the JSON content of the assistant's reply → run the age-appropriateness check →
//   return the output as the step's result.
//   The gateway enforces rule 3 (no direct provider access) and rule 4 (PII guard). Curriculum
//   agents carry no learner data, so provenance stamps deidentified:true with an empty
//   `dropped` list — an honest stamp, not a bypass (rule 4 is about what enters the model,
//   not about suppressing the check).
//
//   The guardrail engine's full input/output composition (`runInputGuardrails`,
//   `runOutputGuardrails` in @infinite-ai/guardrails) is not called from here — most of its
//   checks need data this call site does not have: a per-agent citation set for grounding, a
//   cost budget, a readability range, and (for `checkRefusalPolicy`) an established
//   convention for an agent to signal its own refusal in its structured output, which does
//   not exist yet. Only `checkAgeAppropriateness` is wired in: it needs nothing but the
//   parsed output and an optional injected checker, which is exactly the "mechanism now,
//   real policy wired in once ratified" shape the check was already built for (OQ-015). This
//   is also the first real call site for `EscalationNotifier` (OQ-014) — see
//   `deps.notify`'s doc comment.
//
// tool_call and compensation/tool: look up the handler by toolName and invoke it. The
//   handlers are created by the caller within a withTenant transaction so they have a live
//   TenantClient — rule 5 enforced at the call site, not here.
//
// The runner only calls executeStep for agent_call, tool_call, and compensation kinds;
// human_gate and map/branch are either handled by prepareApproval or not yet executed
// (see runner.ts's own header). Receiving any of those here is a programming error.

import path from 'node:path';

import type { AgentContract } from '@infinite-ai/agents';
import { ChatCompletionRequest, ChatCompletionResponse } from '@infinite-ai/contracts';
import {
  checkAgeAppropriateness,
  defaultEscalationNotifier,
  type AgeAppropriatenessChecker,
  type EscalationNotifier,
  type Refusal,
} from '@infinite-ai/guardrails';
import type {
  PipelineDefinition,
  StepExecutionContext,
  StepExecutor,
} from '@infinite-ai/orchestrator';
import { loadPromptFile } from '@infinite-ai/prompts';

export type ToolHandler = (input: unknown) => Promise<unknown>;
export type ToolHandlerMap = ReadonlyMap<string, ToolHandler>;

export class StepExecutorError extends Error {
  public override readonly name = 'StepExecutorError';
  constructor(message: string) {
    super(message);
  }
}

/** An agent call's output failed a guardrail check. Carries the `Refusal` that caused it —
 * distinct from `StepExecutorError`, which means the call itself broke, not that its
 * content was rejected on review. */
export class GuardrailRefusalError extends Error {
  public override readonly name = 'GuardrailRefusalError';
  constructor(
    message: string,
    public readonly refusal: Refusal,
  ) {
    super(message);
  }
}

export interface StepExecutorDeps {
  readonly pipeline: PipelineDefinition;
  readonly agentContracts: ReadonlyMap<string, AgentContract>;
  /** Absolute path to the prompts source directory — where <agentId>/<version>.prompt.md live. */
  readonly promptsRoot: string;
  readonly gatewayBaseUrl: string;
  readonly tenantId: string;
  readonly toolHandlers: ToolHandlerMap;
  /**
   * Checked against every agent call's parsed output before it becomes the step's result.
   * `undefined` (the default) passes every output — no ratified content-suitability policy
   * exists yet (OQ-015). Supplying a real checker, once one exists, takes effect here with
   * no other code change.
   */
  readonly ageAppropriatenessChecker?: AgeAppropriatenessChecker;
  /**
   * Called when a guardrail check refuses with an escalation route. Defaults to
   * `defaultEscalationNotifier`, which throws rather than silently dropping a safeguarding
   * concern — there is no real paging integration configured in this build yet (OQ-014).
   * Supplying a real notifier, once one exists, takes effect here with no other code change.
   */
  readonly notify?: EscalationNotifier;
}

export function createStepExecutor(deps: StepExecutorDeps): StepExecutor {
  return async function executeStep(context: StepExecutionContext): Promise<unknown> {
    const step = deps.pipeline.steps[context.stepId];
    if (step === undefined) {
      throw new StepExecutorError(
        `Pipeline "${deps.pipeline.id}" has no step "${context.stepId}".`,
      );
    }

    switch (step.kind) {
      case 'agent_call':
        return runAgentCall(step.agentId, context, deps);
      case 'tool_call':
        return runToolCall(
          step.toolName,
          context.stepId,
          context.input,
          deps.toolHandlers,
        );
      case 'compensation': {
        if (step.agentId !== null) return runAgentCall(step.agentId, context, deps);
        if (step.toolName !== null)
          return runToolCall(
            step.toolName,
            context.stepId,
            context.input,
            deps.toolHandlers,
          );
        throw new StepExecutorError(
          `Compensation step "${context.stepId}" has neither agentId nor toolName set.`,
        );
      }
      default:
        throw new StepExecutorError(
          `Step "${context.stepId}" kind "${step.kind}" cannot be dispatched by the step executor.`,
        );
    }
  };
}

async function runAgentCall(
  agentId: string,
  context: StepExecutionContext,
  deps: StepExecutorDeps,
): Promise<unknown> {
  const { runId, stepId, attempt, input, mapItemIndex } = context;

  const contract = deps.agentContracts.get(agentId);
  if (contract === undefined) {
    throw new StepExecutorError(
      `No agent contract registered for "${agentId}" (step "${stepId}").`,
    );
  }

  const promptFile = path.join(
    deps.promptsRoot,
    contract.promptRef.agent,
    `${contract.promptRef.version}.prompt.md`,
  );
  const { body: promptBody } = loadPromptFile(promptFile);

  const requestBody = ChatCompletionRequest.parse({
    tenantId: deps.tenantId,
    module: deps.pipeline.id,
    agent: agentId,
    model: contract.model,
    messages: [
      { role: 'system', content: promptBody },
      { role: 'user', content: JSON.stringify(input) },
    ],
    maxOutputTokens: contract.budget.maxTokens,
    provenance: { deidentified: true, saltVersion: 0, dropped: [] },
    // A map item's stepId is the declared itemStepId, shared by every item in the
    // collection, and its attempt count independently resets to 0 per item — stepId and
    // attempt alone would collide across items (e.g. two learners' first attempts both
    // keying "run-1-screen-learner-item-0"). mapItemIndex disambiguates them; it is unset
    // for a normal, non-map step, leaving that key unchanged.
    idempotencyKey:
      mapItemIndex === undefined
        ? `${runId}-${stepId}-${attempt}`
        : `${runId}-${stepId}-${mapItemIndex}-${attempt}`,
  });

  const response = await fetch(`${deps.gatewayBaseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new StepExecutorError(
      `Gateway returned HTTP ${response.status} for agent "${agentId}": ${text.slice(0, 300)}`,
    );
  }

  const rawJson: unknown = await response.json();
  const parsed = ChatCompletionResponse.parse(rawJson);

  // Every agent in this system is instructed to return structured JSON (OUTPUT SCHEMA
  // section of their prompt). A non-JSON reply is a prompt-compliance failure, not a
  // network error — throw so the runner can retry under the step's own maxRetries.
  const content = parsed.message.content;
  let output: unknown;
  try {
    output = JSON.parse(content) as unknown;
  } catch {
    throw new StepExecutorError(
      `Agent "${agentId}" returned non-JSON content (first 200 chars): ${content.slice(0, 200)}`,
    );
  }

  const verdict = checkAgeAppropriateness(output, deps.ageAppropriatenessChecker);
  if (!verdict.passed) {
    if (verdict.refusal.escalation !== null) {
      const notify = deps.notify ?? defaultEscalationNotifier;
      await notify(verdict.refusal.escalation, verdict.refusal);
    }
    throw new GuardrailRefusalError(
      `Agent "${agentId}" (step "${stepId}") output failed a guardrail check: ` +
        verdict.refusal.explanation,
      verdict.refusal,
    );
  }

  return output;
}

async function runToolCall(
  toolName: string,
  stepId: string,
  input: unknown,
  handlers: ToolHandlerMap,
): Promise<unknown> {
  const handler = handlers.get(toolName);
  if (handler === undefined) {
    throw new StepExecutorError(
      `No tool handler registered for "${toolName}" (step "${stepId}").`,
    );
  }
  return handler(input);
}
