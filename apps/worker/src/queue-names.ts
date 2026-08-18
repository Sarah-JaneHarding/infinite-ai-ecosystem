// Queue name constants shared between the enqueuer (API layer) and the worker consumers.
// A typo in either place means jobs are never picked up — a single source of truth here.

export const QUEUE_MOD01 = 'mod-01' as const;
export const QUEUE_MOD04 = 'mod-04' as const;
export const QUEUE_MOD05_CPTD = 'mod-05-cptd' as const;
export const QUEUE_MOD05_PD = 'mod-05-pd' as const;

export type PipelineQueue =
  | typeof QUEUE_MOD01
  | typeof QUEUE_MOD04
  | typeof QUEUE_MOD05_CPTD
  | typeof QUEUE_MOD05_PD;

/** Job payload for every pipeline queue. The run is pre-created by the caller via
 * `startRun()`; the worker advances it to completion. `actorId` is the service account
 * performing the run — required by the audit ledger (rule 6). */
export interface PipelineJobData {
  readonly runId: string;
  readonly tenantId: string;
  readonly actorId: string;
}
