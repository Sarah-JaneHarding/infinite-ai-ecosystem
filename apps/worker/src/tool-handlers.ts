// Tool handler implementations — called by the StepExecutor for tool_call and
// compensation steps. Each handler is created within a withTenant transaction; the
// TenantClient in the closure satisfies rule 5 at the call site in worker-host.ts.
//
// l0.ingest_ratified_source:
//   Stores a ratified CAPS/ATP source document into L0_CONSTITUTION (the Brain's
//   first tier). L0 candidates await human ratification before committing; the write
//   path records the candidate and leaves it at AWAITING_RATIFICATION.
//
// brain.publish_curriculum_version:
//   Records a curriculum version as published. Irreversible in intent — only reached
//   after the hod-approval human_gate (enforced by validatePipelineGating in tests).
//   Written as an L1_NODE in the curriculum graph; no ratification required.
//
// brain.tombstone_curriculum_version (compensation):
//   Records that a published curriculum version has been rolled back — created by the
//   compensation path if audit-coverage fails after publish. Append-only per rule 11:
//   the original publish record is never modified; a new L1_NODE references it.

import { remember } from '@infinite-ai/brain';
import type { TenantClient } from '@infinite-ai/db';
import { z } from 'zod';

import type { ToolHandlerMap } from './step-executor.js';

const IngestInput = z.object({
  documentId: z.string().min(1),
  documentVersion: z.string().min(1),
  content: z.unknown(),
  source: z.string().min(1),
});

const PublishInput = z.object({
  curriculumRunId: z.string().min(1),
  tenantId: z.string().min(1),
  publishedAt: z.string().datetime().optional(),
});

const TombstoneInput = z.object({
  publishedNodeId: z.string().min(1),
  rollbackReason: z.string().min(1),
});

/** Creates the tool handler map for one pipeline job's transaction scope.
 * The transaction is held open for the job by withTenant in worker-host.ts. */
export function createToolHandlers(tx: TenantClient): ToolHandlerMap {
  const handlers = new Map<string, (input: unknown) => Promise<unknown>>();

  handlers.set(
    'l0.ingest_ratified_source',
    async (rawInput: unknown): Promise<unknown> => {
      const input = IngestInput.parse(rawInput);
      return remember(tx, {
        targetTier: 'L0_CONSTITUTION',
        rawPayload: {
          documentId: input.documentId,
          documentVersion: input.documentVersion,
          content: input.content,
        },
        source: input.source,
      });
    },
  );

  handlers.set(
    'brain.publish_curriculum_version',
    async (rawInput: unknown): Promise<unknown> => {
      const input = PublishInput.parse(rawInput);
      const publishedAt = input.publishedAt ?? new Date().toISOString();
      return remember(tx, {
        targetTier: 'L1_NODE',
        rawPayload: {
          kind: 'curriculum_version',
          status: 'published',
          curriculumRunId: input.curriculumRunId,
          tenantId: input.tenantId,
          publishedAt,
        },
        source: 'brain.publish_curriculum_version',
      });
    },
  );

  handlers.set(
    'brain.tombstone_curriculum_version',
    async (rawInput: unknown): Promise<unknown> => {
      const input = TombstoneInput.parse(rawInput);
      // Append-only record that invalidates the published version (rule 11). The original
      // publish node is never modified; this new node references it as superseded.
      return remember(tx, {
        targetTier: 'L1_NODE',
        rawPayload: {
          kind: 'curriculum_version',
          status: 'rolled_back',
          supersedes: input.publishedNodeId,
          rollbackReason: input.rollbackReason,
          rolledBackAt: new Date().toISOString(),
        },
        source: 'brain.tombstone_curriculum_version',
      });
    },
  );

  return handlers;
}
