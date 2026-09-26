// @infinite-ai/worker — BullMQ workers and the DAG runner host.
//
// Entry point: builds the WorkerHost, registers one consumer per pipeline queue, and
// listens for SIGTERM/SIGINT to drain gracefully. All pipelines ship from
// packages/orchestrator; all agent contracts ship from packages/agents. This file is the
// wiring layer — it does not define any domain logic of its own.
//
// Prompts root is resolved relative to this source file so the path is correct in both
// development (ts-node / tsx) and after build. In production the build output mirrors the
// monorepo layout, so the relative ../../packages/prompts/src path holds in both cases.

import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { SNSClient } from '@aws-sdk/client-sns';
import {
  CE01Contract,
  CE02Contract,
  CE03Contract,
  CE04Contract,
  CE05Contract,
  CE06Contract,
  CE07Contract,
  CE08Contract,
  CE09Contract,
  AC01Contract,
  AC02Contract,
  AC03Contract,
  AC04Contract,
  AC05Contract,
  AC06Contract,
  AC07Contract,
  AC08Contract,
  AC09Contract,
  AC10Contract,
  DW01Contract,
  DW02Contract,
  DW03Contract,
  DW04Contract,
  DW05Contract,
  DW06Contract,
  DW07Contract,
  DW08Contract,
  TB01Contract,
  TB02Contract,
  TB03Contract,
  TB04Contract,
  TB05Contract,
  TB06Contract,
  TB07Contract,
  TB08Contract,
  TB09Contract,
  TB10Contract,
  TB11Contract,
  PD01Contract,
  PD02Contract,
  PD03Contract,
  PD04Contract,
  PD05Contract,
  PD06Contract,
  PD07Contract,
  PD08Contract,
  LE01Contract,
  LE02Contract,
  LE03Contract,
  LE04Contract,
  LE05Contract,
  LE06Contract,
  LE07Contract,
  LE08Contract,
  LE09Contract,
} from '@infinite-ai/agents';
import type { AgentContract } from '@infinite-ai/agents';
import { loadEnv } from '@infinite-ai/config';
import { ChatCompletionRequest, ChatCompletionResponse } from '@infinite-ai/contracts';
import {
  createBrainAgeAppropriatenessChecker,
  createGatewayAgeAppropriatenessJudge,
  type DeidentificationProvenance,
  type JudgeGatewayCallFn,
} from '@infinite-ai/guardrails';
import { loadPromptFile } from '@infinite-ai/prompts';
import {
  LE_COMMONS_PIPELINE,
  LE_EVOLUTION_PIPELINE,
  LE_EXEMPLAR_PIPELINE,
  LE_PATTERN_PIPELINE,
  LE_SIGNAL_PIPELINE,
  MOD01_CURRICULUM_PIPELINE,
  MOD02_MONITORING_PIPELINE,
  MOD02_RTI_PIPELINE,
  MOD02_SBST_SCRIBE_PIPELINE,
  MOD03_WAREHOUSE_PIPELINE,
  MOD04_TOOLBOX_PIPELINE,
  MOD05_CPTD_PIPELINE,
  MOD05_PD_ANALYSIS_PIPELINE,
} from '@infinite-ai/orchestrator';
import type { PipelineDefinition } from '@infinite-ai/orchestrator';
import { createLogger } from '@infinite-ai/telemetry';

import {
  QUEUE_LE_COMMONS,
  QUEUE_LE_EVOLUTION,
  QUEUE_LE_EXEMPLAR,
  QUEUE_LE_PATTERN_MINING,
  QUEUE_LE_SIGNAL,
  QUEUE_MOD01,
  QUEUE_MOD02_MONITORING,
  QUEUE_MOD02_RTI,
  QUEUE_MOD02_SBST_SCRIBE,
  QUEUE_MOD03_WAREHOUSE,
  QUEUE_MOD04,
  QUEUE_MOD05_CPTD,
  QUEUE_MOD05_PD,
} from './queue-names.js';
import { createWorkerHealthServer } from './health-server.js';
import { createSnsEscalationNotifier } from './sns-escalation-notifier.js';
import { WorkerHost } from './worker-host.js';

export { WorkerHost } from './worker-host.js';
export { createWorkerHealthServer } from './health-server.js';
export type { WorkerHealthServer } from './health-server.js';
export {
  createStepExecutor,
  StepExecutorError,
  GuardrailRefusalError,
} from './step-executor.js';
export type { ToolHandler, ToolHandlerMap, StepExecutorDeps } from './step-executor.js';
export { createToolHandlers } from './tool-handlers.js';
export { evaluateCondition, UnresolvedConditionError } from './condition-evaluator.js';
export {
  SnsEscalationError,
  createSnsEscalationNotifier,
} from './sns-escalation-notifier.js';
export {
  QUEUE_LE_COMMONS,
  QUEUE_LE_EVOLUTION,
  QUEUE_LE_EXEMPLAR,
  QUEUE_LE_PATTERN_MINING,
  QUEUE_LE_SIGNAL,
  QUEUE_MOD01,
  QUEUE_MOD02_MONITORING,
  QUEUE_MOD02_RTI,
  QUEUE_MOD02_SBST_SCRIBE,
  QUEUE_MOD03_WAREHOUSE,
  QUEUE_MOD04,
  QUEUE_MOD05_CPTD,
  QUEUE_MOD05_PD,
} from './queue-names.js';
export type { PipelineJobData } from './queue-names.js';

export const PACKAGE_NAME = '@infinite-ai/worker' as const;

const ALL_CONTRACTS: readonly AgentContract[] = [
  CE01Contract,
  CE02Contract,
  CE03Contract,
  CE04Contract,
  CE05Contract,
  CE06Contract,
  CE07Contract,
  CE08Contract,
  CE09Contract,
  AC01Contract,
  AC02Contract,
  AC03Contract,
  AC04Contract,
  AC05Contract,
  AC06Contract,
  AC07Contract,
  AC08Contract,
  AC09Contract,
  AC10Contract,
  DW01Contract,
  DW02Contract,
  DW03Contract,
  DW04Contract,
  DW05Contract,
  DW06Contract,
  DW07Contract,
  DW08Contract,
  TB01Contract,
  TB02Contract,
  TB03Contract,
  TB04Contract,
  TB05Contract,
  TB06Contract,
  TB07Contract,
  TB08Contract,
  TB09Contract,
  TB10Contract,
  TB11Contract,
  PD01Contract,
  PD02Contract,
  PD03Contract,
  PD04Contract,
  PD05Contract,
  PD06Contract,
  PD07Contract,
  PD08Contract,
  LE01Contract,
  LE02Contract,
  LE03Contract,
  LE04Contract,
  LE05Contract,
  LE06Contract,
  LE07Contract,
  LE08Contract,
  LE09Contract,
];

export function buildAgentContractMap(): ReadonlyMap<string, AgentContract> {
  const map = new Map<string, AgentContract>();
  for (const contract of ALL_CONTRACTS) {
    map.set(contract.id, contract);
  }
  return map;
}

export function buildPipelineMap(): ReadonlyMap<string, PipelineDefinition> {
  const map = new Map<string, PipelineDefinition>();
  for (const pipeline of [
    MOD01_CURRICULUM_PIPELINE,
    MOD02_RTI_PIPELINE,
    MOD02_MONITORING_PIPELINE,
    MOD02_SBST_SCRIBE_PIPELINE,
    MOD03_WAREHOUSE_PIPELINE,
    MOD04_TOOLBOX_PIPELINE,
    MOD05_CPTD_PIPELINE,
    MOD05_PD_ANALYSIS_PIPELINE,
    LE_SIGNAL_PIPELINE,
    LE_PATTERN_PIPELINE,
    LE_EVOLUTION_PIPELINE,
    LE_EXEMPLAR_PIPELINE,
    LE_COMMONS_PIPELINE,
  ]) {
    map.set(pipeline.id, pipeline);
  }
  return map;
}

/** The absolute path to the prompts source tree — works from both src/ and built output. */
function resolvePromptsRoot(): string {
  const thisFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(thisFile), '../../../packages/prompts/src');
}

/**
 * `JudgeGatewayCallFn` implementation for `createGatewayAgeAppropriatenessJudge` — the same
 * "POST to /v1/chat/completions, throw on a non-2xx response" shape `step-executor.ts`'s own
 * `runAgentCall` already uses for every other gateway call this app makes. Throwing here
 * (rather than swallowing) is deliberate: the judge's own fail-closed try/catch is what turns
 * this into `appropriate: false` — this function's job is just to report the failure
 * honestly, not to decide what it means.
 */
function createWorkerGatewayCall(gatewayBaseUrl: string): JudgeGatewayCallFn {
  return async (request) => {
    const response = await fetch(`${gatewayBaseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ChatCompletionRequest.parse(request)),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Gateway returned HTTP ${response.status} for the age-appropriateness judge: ` +
          text.slice(0, 300),
      );
    }
    const rawJson: unknown = await response.json();
    return ChatCompletionResponse.parse(rawJson);
  };
}

/**
 * The provenance stamp for the judge's own gateway call. Honest only for the scope
 * `createBrainAgeAppropriatenessChecker` already documents itself as built for — MOD-01/
 * MOD-04 curriculum-planning pipelines, which carry no learner-derived text (the same
 * `CURRICULUM_PROVENANCE` reasoning `packages/curriculum-seed`'s CE executors already use).
 * A pipeline whose output could carry learner-derived text needs a real de-identification
 * step before this stamp would be true for it — see `age-appropriateness-judge.ts`'s own
 * header for why this is a required constructor parameter rather than a silent default.
 */
const CURRICULUM_PLANNING_PROVENANCE: DeidentificationProvenance = {
  deidentified: true,
  saltVersion: 0,
  dropped: [],
};

/** Starts all BullMQ consumers and blocks until SIGTERM or SIGINT. */
export async function start(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger({ level: env.LOG_LEVEL });

  logger.info('worker.starting', {
    queues: [
      QUEUE_MOD01,
      QUEUE_MOD02_RTI,
      QUEUE_MOD02_MONITORING,
      QUEUE_MOD02_SBST_SCRIBE,
      QUEUE_MOD03_WAREHOUSE,
      QUEUE_MOD04,
      QUEUE_MOD05_CPTD,
      QUEUE_MOD05_PD,
      QUEUE_LE_SIGNAL,
      QUEUE_LE_PATTERN_MINING,
      QUEUE_LE_EVOLUTION,
      QUEUE_LE_EXEMPLAR,
      QUEUE_LE_COMMONS,
    ],
  });

  // OQ-015 Gap 2 (model-call half): a real AgeAppropriatenessJudge, loaded once at
  // startup rather than per-call — the prompt body never changes between calls within one
  // process lifetime, the same "load once, reuse" shape contracts/prompts loading already
  // gets for agent prompts via WorkerHost's own promptsRoot.
  const { body: ageAppropriatenessJudgePromptBody } = loadPromptFile(
    path.join(resolvePromptsRoot(), 'AGE-APPROPRIATENESS-JUDGE', '1.0.0.prompt.md'),
  );
  const ageAppropriatenessGatewayCall = createWorkerGatewayCall(env.GATEWAY_BASE_URL);

  const host = new WorkerHost({
    pipelines: buildPipelineMap(),
    agentContracts: buildAgentContractMap(),
    promptsRoot: resolvePromptsRoot(),
    redisUrl: env.REDIS_URL,
    logger,
    // OQ-015 Gap 1 (phase context) and Gap 2 (the model call) are both wired here now.
    // MOD-01 and MOD-04 jobs that include gradePhase on the job payload get a phase-scoped
    // checker, grounded in the ratified Brain clauses for that phase, that renders a real
    // verdict via the Model Gateway and fails closed if that call cannot be completed (see
    // age-appropriateness-judge.ts's own header). Jobs without gradePhase fall through to
    // undefined (no checker) — unchanged from before this wiring.
    ageAppropriatenessCheckerFactory: (tx, tenantId, phase) =>
      createBrainAgeAppropriatenessChecker(
        tx,
        tenantId,
        phase,
        createGatewayAgeAppropriatenessJudge(
          ageAppropriatenessGatewayCall,
          tenantId,
          ageAppropriatenessJudgePromptBody,
          CURRICULUM_PLANNING_PROVENANCE,
        ),
      ),
    // OQ-014: wire the real SNS notifier when the topic ARN is configured.
    // When absent, WorkerHost's default falls through to defaultEscalationNotifier
    // which throws loudly rather than silently no-oping on a safeguarding refusal.
    ...(env.SAFEGUARDING_SNS_TOPIC_ARN === undefined
      ? {}
      : {
          notify: createSnsEscalationNotifier(
            new SNSClient({}),
            env.SAFEGUARDING_SNS_TOPIC_ARN,
          ),
        }),
  });

  host
    .register(QUEUE_MOD01, MOD01_CURRICULUM_PIPELINE.id)
    .register(QUEUE_MOD02_RTI, MOD02_RTI_PIPELINE.id)
    .register(QUEUE_MOD02_MONITORING, MOD02_MONITORING_PIPELINE.id)
    .register(QUEUE_MOD02_SBST_SCRIBE, MOD02_SBST_SCRIBE_PIPELINE.id)
    .register(QUEUE_MOD03_WAREHOUSE, MOD03_WAREHOUSE_PIPELINE.id)
    .register(QUEUE_MOD04, MOD04_TOOLBOX_PIPELINE.id)
    .register(QUEUE_MOD05_CPTD, MOD05_CPTD_PIPELINE.id)
    .register(QUEUE_MOD05_PD, MOD05_PD_ANALYSIS_PIPELINE.id)
    .register(QUEUE_LE_SIGNAL, LE_SIGNAL_PIPELINE.id)
    .register(QUEUE_LE_PATTERN_MINING, LE_PATTERN_PIPELINE.id)
    .register(QUEUE_LE_EVOLUTION, LE_EVOLUTION_PIPELINE.id)
    .register(QUEUE_LE_EXEMPLAR, LE_EXEMPLAR_PIPELINE.id)
    .register(QUEUE_LE_COMMONS, LE_COMMONS_PIPELINE.id);

  const health = createWorkerHealthServer();
  health.listen(env.WORKER_PORT);
  health.setReady(true);

  logger.info('worker.started', { healthPort: env.WORKER_PORT });

  await new Promise<void>((resolve) => {
    const shutdown = (): void => {
      resolve();
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  });

  health.setReady(false);
  logger.info('worker.shutting_down');
  await host.close();
  await health.close();
  logger.info('worker.stopped');
}
