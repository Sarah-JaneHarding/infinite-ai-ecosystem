// Which queue each pipeline's jobs are consumed from — the one place that pairing lives.
// `index.ts` registers a consumer per binding; the dev pipeline runner enqueues onto the
// same queue. Declared once so the two cannot drift (queue-names.ts: "a typo in either
// place means jobs are never picked up").

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
  type PipelineQueue,
} from './queue-names.js';

export interface PipelineQueueBinding {
  readonly queue: PipelineQueue;
  readonly pipeline: PipelineDefinition;
}

export const PIPELINE_QUEUE_BINDINGS: readonly PipelineQueueBinding[] = [
  { queue: QUEUE_MOD01, pipeline: MOD01_CURRICULUM_PIPELINE },
  { queue: QUEUE_MOD02_RTI, pipeline: MOD02_RTI_PIPELINE },
  { queue: QUEUE_MOD02_MONITORING, pipeline: MOD02_MONITORING_PIPELINE },
  { queue: QUEUE_MOD02_SBST_SCRIBE, pipeline: MOD02_SBST_SCRIBE_PIPELINE },
  { queue: QUEUE_MOD03_WAREHOUSE, pipeline: MOD03_WAREHOUSE_PIPELINE },
  { queue: QUEUE_MOD04, pipeline: MOD04_TOOLBOX_PIPELINE },
  { queue: QUEUE_MOD05_CPTD, pipeline: MOD05_CPTD_PIPELINE },
  { queue: QUEUE_MOD05_PD, pipeline: MOD05_PD_ANALYSIS_PIPELINE },
  { queue: QUEUE_LE_SIGNAL, pipeline: LE_SIGNAL_PIPELINE },
  { queue: QUEUE_LE_PATTERN_MINING, pipeline: LE_PATTERN_PIPELINE },
  { queue: QUEUE_LE_EVOLUTION, pipeline: LE_EVOLUTION_PIPELINE },
  { queue: QUEUE_LE_EXEMPLAR, pipeline: LE_EXEMPLAR_PIPELINE },
  { queue: QUEUE_LE_COMMONS, pipeline: LE_COMMONS_PIPELINE },
];
