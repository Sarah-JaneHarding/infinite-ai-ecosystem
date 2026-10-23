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
import type { TenantClient } from '@infinite-ai/db';
import type {
  AgeAppropriatenessChecker,
  EscalationNotifier,
} from '@infinite-ai/guardrails';
import type { CapsPhase } from '@infinite-ai/contracts';
import type { PipelineDefinition } from '@infinite-ai/orchestrator';
import { createLogger, type Logger } from '@infinite-ai/telemetry';
import { Queue, Worker } from 'bullmq';

import { processPipelineJob } from './job-processor.js';
import type { PipelineJobData } from './queue-names.js';
import { QUEUE_LE_SIGNAL } from './queue-names.js';

export interface WorkerHostDeps {
  readonly pipelines: ReadonlyMap<string, PipelineDefinition>;
  readonly agentContracts: ReadonlyMap<string, AgentContract>;
  readonly promptsRoot: string;
  readonly redisUrl: string;
  readonly logger?: Logger;
  /** Forwarded to every StepExecutor this host creates — see step-executor.ts's own doc
   * comments (OQ-014, OQ-015) for what each one does and why it defaults to unset. */
  readonly ageAppropriatenessChecker?: AgeAppropriatenessChecker;
  /**
   * Per-job factory for phase-aware age-appropriateness checking (OQ-015 Gap 1).
   * When a job carries `gradePhase`, the host calls this factory inside the `withTenant`
   * transaction and uses the returned checker for that job in place of the static
   * `ageAppropriatenessChecker`. Pipelines that do not carry a phase (or that supply
   * no `gradePhase` on the job payload) fall back to `ageAppropriatenessChecker` as before.
   * This is the injection point for `createBrainAgeAppropriatenessChecker`.
   */
  readonly ageAppropriatenessCheckerFactory?: (
    tx: TenantClient,
    tenantId: string,
    phase: CapsPhase,
  ) => AgeAppropriatenessChecker;
  readonly notify?: EscalationNotifier;
}

export class WorkerHost {
  private readonly workers: Worker[] = [];
  private readonly leSignalQueue: Queue<PipelineJobData>;
  private readonly logger: Logger;

  constructor(private readonly deps: WorkerHostDeps) {
    this.logger = deps.logger ?? createLogger();
    this.leSignalQueue = new Queue<PipelineJobData>(QUEUE_LE_SIGNAL, {
      connection: { url: deps.redisUrl },
    });
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
        const pendingLeSignalJobs = await processPipelineJob(
          { ...this.deps, gatewayBaseUrl: env.GATEWAY_BASE_URL },
          pipeline,
          job.data,
        );

        // Flush LE signal jobs after the DB transaction commits — safe to enqueue now.
        for (const leJob of pendingLeSignalJobs) {
          await this.leSignalQueue.add('le-signal', leJob);
        }
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
    await Promise.all([
      ...this.workers.map((w) => w.close()),
      this.leSignalQueue.close(),
    ]);
  }
}
