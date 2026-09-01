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
//   `checkDiagnosticLanguage` (OQ-026) is now wired in too, ahead of the age-appropriateness
//   check, but only for a contract that declares `"diagnosis_guard"` in its own `guardrails`
//   array — every such contract also declares `freeTextOutputFields` (an `AgentContract`
//   invariant enforced at `validateAgentContract` time), so this call site never has to
//   guess which output fields are free text: it reads that list straight off the contract
//   and lets `extractFreeText` do the walking.
//
//   `checkReadability` is wired in too, but only for AC-10 (`"readability_guard"` is also
//   declared by TB-03, left for its own follow-up — see the call site's own comment for
//   why): AC-10's own schema already states its exact tolerance rule, so this independently
//   re-measures its self-reported `readabilityAdequate` claim rather than trusting it,
//   English-only (the metric itself is), which AC-10's own `homeLanguage` may not be.
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
  checkDiagnosticLanguage,
  checkReadability,
  defaultEscalationNotifier,
  extractFreeText,
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

  // OQ-026: a MOD-02 agent that declares "diagnosis_guard" also declares which of its own
  // output fields are free text (AgentContract's own invariant — see contract.ts). No
  // injected checker needed, unlike age-appropriateness/template-fidelity: the term list
  // is fixed, not a policy this codebase would otherwise have to invent.
  if (contract.guardrails.includes('diagnosis_guard')) {
    const texts = extractFreeText(output, contract.freeTextOutputFields ?? []);
    const diagnosisVerdict = checkDiagnosticLanguage(texts);
    if (!diagnosisVerdict.passed) {
      throw new GuardrailRefusalError(
        `Agent "${agentId}" (step "${stepId}") output failed diagnosis_guard: ` +
          diagnosisVerdict.refusal.explanation,
        diagnosisVerdict.refusal,
      );
    }
  }

  // A sibling gap to OQ-026, scoped to AC-10 only: "readability_guard" was declared on
  // AC-10's own contract but never independently checked — only ever the agent's own
  // self-reported `readabilityAdequate`, taken at face value. AC10Result's own comment
  // already states the exact rule ("estimatedReadabilityGrade <= targetReadabilityGrade +
  // 1" — a ceiling only, no floor: a guardian letter simpler than the target grade is
  // never a problem), so this re-measures `reportText` with the guardrails package's real
  // Flesch-Kincaid scorer instead of trusting the claim. English only: the metric is
  // English-only (see `packages/contracts`' `toolbox-readability-bands.spec.ts`), and
  // AC-10 may write in any of the eleven official languages (`AC10Input.homeLanguage`) —
  // for anything else there is no validated metric to check against, so the agent's own
  // claim is trusted, the same "no invented metric" carve-out TB-03/TB-06 already
  // established for readability. TB-03 also declares `readability_guard` but is not
  // covered here — a separate, larger piece of work (its own two-sided `GradeBand` and the
  // same English-only carve-out) left for its own follow-up rather than guessed at now.
  if (agentId === 'AC-10' && contract.guardrails.includes('readability_guard')) {
    const reportText = (output as { reportText?: unknown } | null)?.reportText;
    const homeLanguage = (input as { homeLanguage?: unknown } | null)?.homeLanguage;
    const targetGrade = (input as { targetReadabilityGrade?: unknown } | null)
      ?.targetReadabilityGrade;
    if (
      typeof reportText === 'string' &&
      homeLanguage === 'en' &&
      typeof targetGrade === 'number'
    ) {
      const readabilityVerdict = checkReadability(reportText, {
        minGrade: Number.NEGATIVE_INFINITY,
        maxGrade: targetGrade + 1,
      });
      if (!readabilityVerdict.passed) {
        throw new GuardrailRefusalError(
          `Agent "${agentId}" (step "${stepId}") output failed readability_guard: ` +
            readabilityVerdict.refusal.explanation,
          readabilityVerdict.refusal,
        );
      }
    }
  }

  const verdict = await checkAgeAppropriateness(output, deps.ageAppropriatenessChecker);
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
