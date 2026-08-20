// brain.publish_curriculum_version tool declaration — Stage 32.
//
// Irreversible write: persists the CE-03..CE-08 curriculum artefact bundle to Brain
// L1_NODE after the HoD approval gate. The pipeline's compensation step is
// brain.tombstone_curriculum_version, which rolls back a committed node if a later step
// (e.g. audit-coverage) fails after this one has already run.
//
// `idempotent: false` — a second call creates a second node; the pipeline runner must not
// retry this step without a compensation pass first.

import { CurriculumPublishInput } from '@infinite-ai/contracts';

import {
  ToolDeclaration,
  type ToolDeclaration as ToolDeclarationType,
} from '../contract.js';

export const BrainPublishCurriculumVersionDeclaration: ToolDeclarationType =
  ToolDeclaration.parse({
    name: 'brain.publish_curriculum_version',
    purpose:
      'Persist the approved curriculum artefact bundle to Brain L1_NODE after HoD approval. Irreversible — compensate with brain.tombstone_curriculum_version if a later step fails.',
    inputSchema: CurriculumPublishInput,
    idempotent: false,
    sideEffect: 'irreversible',
  });
