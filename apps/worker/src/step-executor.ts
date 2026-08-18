// The StepExecutor implementation — the bridge between the orchestrator's DAG runner and
// the real work each step does.
//
// agent_call: load the agent's prompt → POST to the Model Gateway →
//   parse the JSON content of the assistant's reply and return it as the step output.
//   The gateway enforces rule 3 (no direct provider access) and rule 4 (PII guard). Curriculum
//   agents carry no learner data, so provenance stamps deidentified:true with an empty
//   `dropped` list — an honest stamp, not a bypass (rule 4 is about what enters the model,
//   not about suppressing the check).
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

export interface StepExecutorDeps {
  readonly pipeline: PipelineDefinition;
  readonly agentContracts: ReadonlyMap<string, AgentContract>;
  /** Absolute path to the prompts source directory — where <agentId>/<version>.prompt.md live. */
  readonly promptsRoot: string;
  readonly gatewayBaseUrl: string;
  readonly tenantId: string;
  readonly toolHandlers: ToolHandlerMap;
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
  const { runId, stepId, attempt, input } = context;

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
    idempotencyKey: `${runId}-${stepId}-${attempt}`,
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
  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new StepExecutorError(
      `Agent "${agentId}" returned non-JSON content (first 200 chars): ${content.slice(0, 200)}`,
    );
  }
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
