// BullMQ consumer host — one Worker instance per pipeline queue.
//
// Each job follows the same pattern:
//   1. Parse the job data (runId, tenantId, actorId).
//   2. Open a withTenant transaction — rule 5: every DB operation has a tenant context.
//   3. Inside the transaction, create tool handlers (which close over the TenantClient)
//      and a StepExecutor, then call runToCompletion.
//
// `runToCompletion` returns when the run reaches a terminal or paused status, or when no
// further progress is possible on this call (a step within timeout, a retry not yet due).
// BullMQ will re-enqueue the job if the process crashes mid-step — the orchestrator runner
// is resumable by design (it re-reads all decisions from Postgres on every call).
//
// Graceful shutdown: WorkerHost.close() calls Worker.close() for each queue, which drains
// in-flight jobs before the process exits. The default BullMQ close timeout is 5 s.

import type { AgentContract } from '@infinite-ai/agents';
import { loadEnv } from '@infinite-ai/config';
import { withTenant } from '@infinite-ai/db';
import type {
  AgeAppropriatenessChecker,
  EscalationNotifier,
} from '@infinite-ai/guardrails';
import type { PipelineDefinition, RunnerOptions } from '@infinite-ai/orchestrator';
import { runToCompletion } from '@infinite-ai/orchestrator';
import { createLogger, type Logger } from '@infinite-ai/telemetry';
import { Worker } from 'bullmq';
import { z } from 'zod';

import { prepareApproval } from './approval.js';
import { evaluateCondition } from './condition-evaluator.js';
import type { PipelineJobData } from './queue-names.js';
import { createStepExecutor } from './step-executor.js';
import { createToolHandlers } from './tool-handlers.js';

const JobDataSchema = z.object({
  runId: z.string().min(1),
  tenantId: z.string().min(1),
  actorId: z.string().min(1),
});

export interface WorkerHostDeps {
  readonly pipelines: ReadonlyMap<string, PipelineDefinition>;
  readonly agentContracts: ReadonlyMap<string, AgentContract>;
  readonly promptsRoot: string;
  readonly redisUrl: string;
  readonly logger?: Logger;
  /** Forwarded to every StepExecutor this host creates — see step-executor.ts's own doc
   * comments (OQ-014, OQ-015) for what each one does and why it defaults to unset. */
  readonly ageAppropriatenessChecker?: AgeAppropriatenessChecker;
  readonly notify?: EscalationNotifier;
}

export class WorkerHost {
  private readonly workers: Worker[] = [];
  private readonly logger: Logger;

  constructor(private readonly deps: WorkerHostDeps) {
    this.logger = deps.logger ?? createLogger();
  }

  /** Registers one BullMQ Worker for the given queue, wired to the pipeline. */
  register(queueName: string, pipelineId: string): this {
    const pipeline = this.deps.pipelines.get(pipelineId);
    if (pipeline === undefined) {
      throw new Error(`WorkerHost: no pipeline registered for id "${pipelineId}".`);
    }

    const env = loadEnv();

    const worker = new Worker<PipelineJobData>(
      queueName,
      async (job) => {
        const jobData = JobDataSchema.parse(job.data);
        const { runId, tenantId, actorId } = jobData;

        await withTenant({ tenantId, actorId }, async (tx) => {
          const toolHandlers = createToolHandlers(tx);

          // exactOptionalPropertyTypes (rule 8): only set these keys when this host was
          // actually given a checker/notifier, rather than assigning `undefined` to an
          // optional field explicitly.
          const executeStep = createStepExecutor({
            pipeline,
            agentContracts: this.deps.agentContracts,
            promptsRoot: this.deps.promptsRoot,
            gatewayBaseUrl: env.GATEWAY_BASE_URL,
            tenantId,
            toolHandlers,
            ...(this.deps.ageAppropriatenessChecker === undefined
              ? {}
              : { ageAppropriatenessChecker: this.deps.ageAppropriatenessChecker }),
            ...(this.deps.notify === undefined ? {} : { notify: this.deps.notify }),
          });

          const runnerOptions: RunnerOptions = {
            executeStep,
            prepareApproval,
            evaluateCondition,
          };

          await runToCompletion(tx, pipeline, runId, runnerOptions);
        });
      },
      {
        connection: { url: this.deps.redisUrl },
        concurrency: 5,
      },
    );

    worker.on('failed', (job, err) => {
      this.logger.error('worker.job_failed', {
        queue: queueName,
        jobId: job?.id ?? '(no id)',
        error: err instanceof Error ? err.message : String(err),
      });
    });

    this.workers.push(worker);
    return this;
  }

  /** Gracefully drains all workers (waits for in-flight jobs, then closes). */
  async close(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.close()));
  }
}
