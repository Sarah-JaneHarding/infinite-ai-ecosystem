// Runs ONE agent against the live Model Gateway exactly as the worker would for an
// `agent_call` step — same prompt file, same request, same parsing, same production
// guardrails (`createStepExecutor`) — and keeps everything a calibration needs that the
// worker discards: the raw reply, token usage, the provider that served it, latency, and
// which stage a failure happened at.
//
// What it does NOT do is what the worker does not do either: no Brain/L0 retrieval and no
// chaining from a previous agent's output (every step is handed the input as given). It
// measures the prompt + model, which is the thing being iterated on.

import type { AgentContract } from '@infinite-ai/agents';
import { ChatCompletionResponse } from '@infinite-ai/contracts';
import type { AgeAppropriatenessChecker } from '@infinite-ai/guardrails';
import { PipelineDefinition, type StepExecutor } from '@infinite-ai/orchestrator';

import {
  type AgentPayloadBuilder,
  GuardrailRefusalError,
  StepExecutorError,
  createStepExecutor,
} from '../step-executor.js';

export type AgentCallOutcome =
  'ok' | 'invalid_input' | 'gateway_error' | 'non_json' | 'guardrail_refused' | 'error';

export interface AgentCallRecord {
  readonly agentId: string;
  readonly label: string;
  readonly contractVersion: string;
  readonly promptVersion: string;
  readonly logicalModel: string;
  readonly tenantId: string;
  readonly startedAt: string;
  readonly latencyMs: number;
  readonly input: unknown;
  readonly outcome: AgentCallOutcome;
  /** The model's reply, byte for byte, even when it was not valid JSON. */
  readonly rawContent: string | null;
  readonly output: unknown;
  readonly provider: string | null;
  readonly cached: boolean | null;
  readonly usage: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
  } | null;
  readonly gatewayStatus: number | null;
  readonly error: string | null;
  /** Zod issues when `outcome` is `invalid_input`; empty otherwise. */
  readonly inputIssues: readonly string[];
}

export class AgentRunnerError extends Error {
  public override readonly name = 'AgentRunnerError';
}

export interface AgentRunnerDeps {
  readonly contracts: ReadonlyMap<string, AgentContract>;
  readonly promptsRoot: string;
  readonly gatewayBaseUrl: string;
  readonly tenantId: string;
  readonly fetchImpl?: typeof fetch;
  readonly ageAppropriatenessChecker?: AgeAppropriatenessChecker;
  /** Adds developer-supplied context to the call (`--context-file`). Unset: input only. */
  readonly payloadBuilder?: AgentPayloadBuilder;
  readonly now?: () => number;
  /** Send an input that fails the agent's `inputSchema` anyway. Default: skip the call. */
  readonly sendInvalidInput?: boolean;
}

function singleStepPipeline(agentId: string): PipelineDefinition {
  return PipelineDefinition.parse({
    id: 'dev-run-agent',
    version: '1.0.0',
    entryStepId: 'call',
    steps: {
      call: {
        id: 'call',
        kind: 'agent_call',
        agentId,
        timeoutMs: 600_000,
        maxRetries: 0,
        compensatesWith: null,
        next: null,
      },
    },
  });
}

interface Captured {
  status: number | null;
  body: string | null;
}

export async function runAgentLive(
  deps: AgentRunnerDeps,
  agentId: string,
  input: unknown,
  label: string,
): Promise<AgentCallRecord> {
  const contract = deps.contracts.get(agentId);
  if (contract === undefined) {
    throw new AgentRunnerError(`No agent contract registered for "${agentId}".`);
  }
  const now = deps.now ?? Date.now;
  const startedMs = now();
  const base = {
    agentId,
    label,
    contractVersion: contract.version,
    promptVersion: contract.promptRef.version,
    logicalModel: contract.model,
    tenantId: deps.tenantId,
    startedAt: new Date(startedMs).toISOString(),
    input,
  };
  const empty = {
    rawContent: null,
    output: undefined,
    provider: null,
    cached: null,
    usage: null,
    gatewayStatus: null,
    error: null,
    inputIssues: [] as readonly string[],
  };

  const parsedInput = contract.inputSchema.safeParse(input);
  if (!parsedInput.success && deps.sendInvalidInput !== true) {
    return {
      ...base,
      ...empty,
      latencyMs: 0,
      outcome: 'invalid_input',
      error: 'Input does not satisfy the agent inputSchema; no model call was made.',
      inputIssues: parsedInput.error.issues.map(
        (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
      ),
    };
  }

  const captured: Captured = { status: null, body: null };
  const recordingFetch: typeof fetch = async (url, init) => {
    const response = await (deps.fetchImpl ?? fetch)(url, init);
    captured.status = response.status;
    captured.body = await response.clone().text();
    return response;
  };

  const executeStep: StepExecutor = createStepExecutor({
    pipeline: singleStepPipeline(agentId),
    agentContracts: deps.contracts,
    promptsRoot: deps.promptsRoot,
    gatewayBaseUrl: deps.gatewayBaseUrl,
    fetchImpl: recordingFetch,
    tenantId: deps.tenantId,
    toolHandlers: new Map(),
    ...(deps.payloadBuilder === undefined ? {} : { buildPayload: deps.payloadBuilder }),
    ...(deps.ageAppropriatenessChecker === undefined
      ? {}
      : { ageAppropriatenessChecker: deps.ageAppropriatenessChecker }),
  });

  let output: unknown;
  let outcome: AgentCallOutcome = 'ok';
  let error: string | null = null;
  try {
    output = await executeStep({
      runId: `dev-${startedMs}`,
      stepId: 'call',
      attempt: 0,
      input,
    });
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
    if (caught instanceof GuardrailRefusalError) outcome = 'guardrail_refused';
    else if (captured.status !== null && captured.status >= 400)
      outcome = 'gateway_error';
    else if (captured.status === null) outcome = 'gateway_error';
    else if (caught instanceof StepExecutorError) outcome = 'non_json';
    else outcome = 'error';
  }

  const reply =
    captured.body === null
      ? undefined
      : (() => {
          try {
            return ChatCompletionResponse.safeParse(JSON.parse(captured.body));
          } catch {
            return undefined;
          }
        })();
  const response = reply?.success === true ? reply.data : null;

  return {
    ...base,
    ...empty,
    latencyMs: now() - startedMs,
    outcome,
    rawContent: response?.message.content ?? null,
    output,
    provider: response?.provider ?? null,
    cached: response?.cached ?? null,
    usage: response?.usage ?? null,
    gatewayStatus: captured.status,
    error,
    inputIssues: parsedInput.success
      ? []
      : parsedInput.error.issues.map(
          (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
        ),
  };
}
