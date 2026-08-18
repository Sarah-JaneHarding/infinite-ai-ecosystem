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
} from '@infinite-ai/agents';
import type { AgentContract } from '@infinite-ai/agents';
import { loadEnv } from '@infinite-ai/config';
import {
  MOD01_CURRICULUM_PIPELINE,
  MOD04_TOOLBOX_PIPELINE,
  MOD05_CPTD_PIPELINE,
  MOD05_PD_ANALYSIS_PIPELINE,
} from '@infinite-ai/orchestrator';
import type { PipelineDefinition } from '@infinite-ai/orchestrator';
import { createLogger } from '@infinite-ai/telemetry';

import {
  QUEUE_MOD01,
  QUEUE_MOD04,
  QUEUE_MOD05_CPTD,
  QUEUE_MOD05_PD,
} from './queue-names.js';
import { WorkerHost } from './worker-host.js';

export { WorkerHost } from './worker-host.js';
export { createStepExecutor, StepExecutorError } from './step-executor.js';
export type { ToolHandler, ToolHandlerMap, StepExecutorDeps } from './step-executor.js';
export { createToolHandlers } from './tool-handlers.js';
export {
  QUEUE_MOD01,
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
    MOD04_TOOLBOX_PIPELINE,
    MOD05_CPTD_PIPELINE,
    MOD05_PD_ANALYSIS_PIPELINE,
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

/** Starts all BullMQ consumers and blocks until SIGTERM or SIGINT. */
export async function start(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger({ level: env.LOG_LEVEL });

  logger.info('worker.starting', {
    queues: [QUEUE_MOD01, QUEUE_MOD04, QUEUE_MOD05_CPTD, QUEUE_MOD05_PD],
  });

  const host = new WorkerHost({
    pipelines: buildPipelineMap(),
    agentContracts: buildAgentContractMap(),
    promptsRoot: resolvePromptsRoot(),
    redisUrl: env.REDIS_URL,
    logger,
  });

  host
    .register(QUEUE_MOD01, MOD01_CURRICULUM_PIPELINE.id)
    .register(QUEUE_MOD04, MOD04_TOOLBOX_PIPELINE.id)
    .register(QUEUE_MOD05_CPTD, MOD05_CPTD_PIPELINE.id)
    .register(QUEUE_MOD05_PD, MOD05_PD_ANALYSIS_PIPELINE.id);

  logger.info('worker.started');

  await new Promise<void>((resolve) => {
    const shutdown = (): void => {
      resolve();
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  });

  logger.info('worker.shutting_down');
  await host.close();
  logger.info('worker.stopped');
}
