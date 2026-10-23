// Starts a pipeline run for real and lets a developer watch it: validate the input against
// the agents it will reach, open the run, enqueue the same BullMQ job the worker consumes,
// then read the run back through the Run Inspector until it finishes or waits for a person.
//
// It never decides a human gate. A run that reaches one stays `WAITING_FOR_APPROVAL` until
// someone with the gate's role decides it in the web app (rule 6). Everything runs inside
// `withTenant` (rule 5).

import type { AgentContract } from '@infinite-ai/agents';
import { withTenant } from '@infinite-ai/db';
import {
  inspectRun,
  startRun,
  type PipelineDefinition,
  type RunInspection,
} from '@infinite-ai/orchestrator';
import { Queue } from 'bullmq';

import { PIPELINE_QUEUE_BINDINGS } from '../pipeline-bindings.js';
import type { PipelineJobData } from '../queue-names.js';
import { mergeTemplates, templateFor } from './schema-template.js';

export class PipelineRunnerError extends Error {
  public override readonly name = 'PipelineRunnerError';
}

export const TERMINAL_RUN_STATUSES: readonly string[] = [
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'COMPENSATED',
];

export function bindingFor(pipelineId: string): (typeof PIPELINE_QUEUE_BINDINGS)[number] {
  const binding = PIPELINE_QUEUE_BINDINGS.find((b) => b.pipeline.id === pipelineId);
  if (binding === undefined) {
    throw new PipelineRunnerError(
      `Unknown pipeline "${pipelineId}". Known: ${PIPELINE_QUEUE_BINDINGS.map((b) => b.pipeline.id).join(', ')}.`,
    );
  }
  return binding;
}

/** The agents a pipeline calls directly (`agent_call`/`compensation`) and, separately, the
 * agents it calls once per item of a run-input collection (`map`). */
function agentsOf(pipeline: PipelineDefinition): {
  readonly direct: readonly string[];
  readonly perItem: ReadonlyMap<string, readonly string[]>;
} {
  const steps = Object.values(pipeline.steps);
  const itemStepIds = new Set(
    steps.flatMap((s) => (s.kind === 'map' ? [s.itemStepId] : [])),
  );
  const direct = new Set<string>();
  for (const step of steps) {
    if (step.kind === 'agent_call' && !itemStepIds.has(step.id)) direct.add(step.agentId);
    if (step.kind === 'compensation' && step.agentId !== null) direct.add(step.agentId);
  }
  const perItem = new Map<string, string[]>();
  for (const step of steps) {
    if (step.kind !== 'map') continue;
    const item = pipeline.steps[step.itemStepId];
    if (item?.kind === 'agent_call') {
      perItem.set(step.collectionField, [
        ...(perItem.get(step.collectionField) ?? []),
        item.agentId,
      ]);
    }
  }
  return { direct: [...direct], perItem };
}

/** Every problem with `input` for the agents this pipeline will reach, before any model
 * time is spent. Tool-call steps validate their own input when they run. */
export function validatePipelineInput(
  pipeline: PipelineDefinition,
  contracts: ReadonlyMap<string, AgentContract>,
  input: unknown,
): readonly string[] {
  const issues: string[] = [];
  const { direct, perItem } = agentsOf(pipeline);
  const check = (agentId: string, value: unknown, where: string): void => {
    const contract = contracts.get(agentId);
    if (contract === undefined) {
      issues.push(`${where}: no contract registered for agent ${agentId}`);
      return;
    }
    const result = contract.inputSchema.safeParse(value);
    if (!result.success) {
      for (const issue of result.error.issues) {
        issues.push(
          `${agentId} ${where}: ${issue.path.join('.') || '(root)'}: ${issue.message}`,
        );
      }
    }
  };
  for (const agentId of direct) check(agentId, input, 'run input');
  for (const [field, agentIds] of perItem) {
    const collection = (input as Record<string, unknown> | null)?.[field];
    if (!Array.isArray(collection)) {
      issues.push(
        `run input field "${field}" must be an array (the pipeline maps over it)`,
      );
      continue;
    }
    collection.forEach((item, index) => {
      for (const agentId of agentIds) check(agentId, item, `${field}[${index}]`);
    });
  }
  return issues;
}

/** A starting-point input for a pipeline: the required fields of every agent it reaches. */
export function pipelineInputTemplate(
  pipeline: PipelineDefinition,
  contracts: ReadonlyMap<string, AgentContract>,
): Record<string, unknown> {
  const { direct, perItem } = agentsOf(pipeline);
  const fromDirect = direct.flatMap((id) => {
    const contract = contracts.get(id);
    return contract === undefined ? [] : [templateFor(contract.inputSchema)];
  });
  const collections: Record<string, unknown> = {};
  for (const [field, agentIds] of perItem) {
    collections[field] = [
      mergeTemplates(
        agentIds.flatMap((id) => {
          const contract = contracts.get(id);
          return contract === undefined ? [] : [templateFor(contract.inputSchema)];
        }),
      ),
    ];
  }
  return { ...mergeTemplates(fromDirect), ...collections };
}

export interface StartedRun {
  readonly runId: string;
  readonly queue: string;
}

export async function startAndEnqueue(options: {
  readonly pipelineId: string;
  readonly tenantId: string;
  readonly actorId: string;
  readonly redisUrl: string;
  readonly input: unknown;
  readonly gradePhase?: PipelineJobData['gradePhase'];
}): Promise<StartedRun> {
  const { queue, pipeline } = bindingFor(options.pipelineId);
  const traceId = `dev-${Date.now().toString(36)}`;

  // Commit the run before enqueueing, so a worker never picks up a job for a run that a
  // rollback later removed (the same ordering the web app's approval route uses).
  const runId = await withTenant(
    { tenantId: options.tenantId, actorId: options.actorId },
    async (tx) =>
      (await startRun(tx, pipeline, options.input, traceId, options.actorId)).id,
  );

  const jobs = new Queue<PipelineJobData>(queue, {
    connection: { url: options.redisUrl },
  });
  try {
    await jobs.add(
      pipeline.id,
      {
        runId,
        tenantId: options.tenantId,
        actorId: options.actorId,
        ...(options.gradePhase === undefined ? {} : { gradePhase: options.gradePhase }),
      },
      { jobId: runId },
    );
  } finally {
    await jobs.close();
  }
  return { runId, queue };
}

export async function readRun(
  tenantId: string,
  actorId: string,
  runId: string,
  pipeline?: PipelineDefinition,
): Promise<RunInspection | null> {
  return withTenant({ tenantId, actorId }, (tx) => inspectRun(tx, runId, pipeline));
}

/** A one-line-per-step summary, newest state last, for a terminal. */
export function summariseRun(run: RunInspection): string {
  const lines = [
    `run ${run.runId}  ${run.pipelineId}@${run.pipelineVersion}  status ${run.status}` +
      (run.currentStepId === null ? '' : `  at ${run.currentStepId}`),
  ];
  for (const step of run.steps) {
    const latency = step.latencyMs === null ? '-' : `${step.latencyMs}ms`;
    const error = step.error === null ? '' : `  ! ${step.error.slice(0, 160)}`;
    lines.push(`  ${step.stepId}#${step.attempt}  ${step.status}  ${latency}${error}`);
  }
  return lines.join('\n');
}
