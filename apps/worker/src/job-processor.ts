// One pipeline job, start to pause: open a tenant transaction, build the tool handlers and
// step executor inside it, and run the pipeline until it finishes or needs a person.
//
// Extracted from `WorkerHost` unchanged in behaviour so the BullMQ consumer and the dev
// in-process runner (`dev/pipeline-runner.ts`) execute the very same code. The only seam is
// `hooks.payloadBuilder`, which production never sets.

import type { AgentContract } from '@infinite-ai/agents';
import { remember } from '@infinite-ai/brain';
import type { TenantClient } from '@infinite-ai/db';
import { withTenant } from '@infinite-ai/db';
import type {
  AgeAppropriatenessChecker,
  EscalationNotifier,
} from '@infinite-ai/guardrails';
import type { CapsPhase } from '@infinite-ai/contracts';
import type { PipelineDefinition, RunnerOptions } from '@infinite-ai/orchestrator';
import { runToCompletion } from '@infinite-ai/orchestrator';
import { z } from 'zod';

import { prepareApproval } from './approval.js';
import { evaluateCondition } from './condition-evaluator.js';
import { buildPendingLeSignalJob, type PendingLeSignalJob } from './le-signal-trigger.js';
import { createStepExecutor, type AgentPayloadBuilder } from './step-executor.js';
import { createToolHandlers } from './tool-handlers.js';

const CapsPhaseSchema = z.enum(['FOUNDATION', 'INTERMEDIATE', 'SENIOR']);

export const JobDataSchema = z.object({
  runId: z.string().min(1),
  tenantId: z.string().min(1),
  actorId: z.string().min(1),
  gradePhase: CapsPhaseSchema.optional(),
});

export interface JobProcessorDeps {
  readonly agentContracts: ReadonlyMap<string, AgentContract>;
  readonly promptsRoot: string;
  readonly gatewayBaseUrl: string;
  readonly ageAppropriatenessChecker?: AgeAppropriatenessChecker;
  readonly ageAppropriatenessCheckerFactory?: (
    tx: TenantClient,
    tenantId: string,
    phase: CapsPhase,
  ) => AgeAppropriatenessChecker;
  readonly notify?: EscalationNotifier;
}

export interface JobHooks {
  /** Builds the agent payload builder for this job, inside its transaction. Production
   * leaves this unset; the dev `--chain` mode uses it to add upstream outputs and L0
   * documents to each agent's context. */
  readonly payloadBuilder?: (tx: TenantClient, runId: string) => AgentPayloadBuilder;
}

/** Runs the job and returns the Learning-Engine signal jobs it produced. The caller
 * enqueues those only after this returns, i.e. after the transaction committed. */
export async function processPipelineJob(
  deps: JobProcessorDeps,
  pipeline: PipelineDefinition,
  rawJobData: unknown,
  hooks: JobHooks = {},
): Promise<readonly PendingLeSignalJob[]> {
  const jobData = JobDataSchema.parse(rawJobData);
  const { runId, tenantId, actorId } = jobData;
  // gradePhase is read later inside withTenant to build the per-job checker

  // Collected inside the withTenant callback; flushed to BullMQ after the transaction
  // commits so a DB rollback never leaves a phantom LE signal job in Redis.
  const pendingLeSignalJobs: PendingLeSignalJob[] = [];

  await withTenant({ tenantId, actorId }, async (tx) => {
    const toolHandlers = createToolHandlers(tx);

    // Closes over `tx` so the Brain write runs inside the same withTenant transaction
    // as every other database operation in this job — rule 5.
    const brainWriter = async (
      agentId: string,
      contractVersion: string,
      output: unknown,
      runId: string,
    ): Promise<void> => {
      await remember(tx, {
        targetTier: 'L2_EPISODE',
        rawPayload: {
          eventType: 'agent_output',
          subjectNodeId: null,
          actorId: actorId,
          occurredAt: new Date().toISOString(),
          summary: `${agentId}@${contractVersion} persisted output to Brain`,
          detail: { agentId, contractVersion, runId, agentOutput: output },
          outcome: null,
          supersedes: null,
          dataCategory: null,
        },
        source: `${agentId}/${contractVersion}`,
        derivationRunId: runId,
      });
    };

    // Per-job phase-aware checker: when the job carries gradePhase and the host was
    // given a factory, build a checker scoped to that phase inside this transaction
    // (OQ-015 Gap 1). Falls back to the static checker or undefined when absent.
    const jobPhase = jobData.gradePhase;
    const jobAgeChecker: AgeAppropriatenessChecker | undefined =
      jobPhase !== undefined && deps.ageAppropriatenessCheckerFactory !== undefined
        ? deps.ageAppropriatenessCheckerFactory(tx, tenantId, jobPhase)
        : deps.ageAppropriatenessChecker;

    // exactOptionalPropertyTypes (rule 8): only set these keys when this host was
    // actually given a checker/notifier, rather than assigning `undefined` to an
    // optional field explicitly.
    const executeStep = createStepExecutor({
      pipeline,
      agentContracts: deps.agentContracts,
      promptsRoot: deps.promptsRoot,
      gatewayBaseUrl: deps.gatewayBaseUrl,
      tenantId,
      toolHandlers,
      brainWriter,
      ...(hooks.payloadBuilder === undefined
        ? {}
        : { buildPayload: hooks.payloadBuilder(tx, runId) }),
      ...(jobAgeChecker === undefined
        ? {}
        : { ageAppropriatenessChecker: jobAgeChecker }),
      ...(deps.notify === undefined ? {} : { notify: deps.notify }),
    });

    const runnerOptions: RunnerOptions = {
      executeStep,
      prepareApproval,
      evaluateCondition,
      onHumanGateResolved: async (tx, _runId, _stepId, task) => {
        // decidedBy is always set at this point — decideHumanGate requires it —
        // but guard defensively to avoid a runtime throw.
        if (task.decidedBy === null) return;
        const job = await buildPendingLeSignalJob(tx, task, task.decidedBy);
        if (job !== null) {
          pendingLeSignalJobs.push(job);
        }
      },
    };

    await runToCompletion(tx, pipeline, runId, runnerOptions);
  });

  return pendingLeSignalJobs;
}
