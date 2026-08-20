// brain.tombstone_curriculum_version tool declaration — Stage 32.
//
// Compensation step for brain.publish_curriculum_version. Called by the pipeline runner
// when any step after publish-to-brain fails: it tombstones the L1_NODE written by the
// publish step so the curriculum version is no longer effective in Brain retrieval.
//
// `sideEffect: 'write'` rather than 'irreversible' because a tombstone follows the Brain's
// append-only rule — it is reversible in principle (a new superseding row can be written),
// even though the pipeline only calls it as a rollback.

import { CurriculumTombstoneInput } from '@infinite-ai/contracts';

import {
  ToolDeclaration,
  type ToolDeclaration as ToolDeclarationType,
} from '../contract.js';

export const BrainTombstoneCurriculumVersionDeclaration: ToolDeclarationType =
  ToolDeclaration.parse({
    name: 'brain.tombstone_curriculum_version',
    purpose:
      'Compensation step: tombstone a published curriculum L1_NODE when a later pipeline step fails after brain.publish_curriculum_version has already committed.',
    inputSchema: CurriculumTombstoneInput,
    idempotent: false,
    sideEffect: 'write',
  });
