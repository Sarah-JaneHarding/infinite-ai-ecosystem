// Curriculum Brain tool input schemas — Stage 32.
//
// Input contracts for the two Brain-side tools in the MOD-01 pipeline:
//   brain.publish_curriculum_version — irreversible, called after HoD approval
//   brain.tombstone_curriculum_version — compensation step if a later stage fails
//
// Both are "empty vessel" schemas: the shapes are real and validated, but the
// executors write to L1_NODE using the Brain's `remember()` / `forget()` APIs and
// will be wired to a real curriculum package type once CE-08's output schema
// stabilises. Keeping the contracts minimal here avoids coupling this stage to
// CE-08's own still-developing output shape.

import { z } from 'zod';

import { GradeLabel } from './framework.js';

// ---------------------------------------------------------------------------
// brain.publish_curriculum_version
// ---------------------------------------------------------------------------

/**
 * What the pipeline passes to the publish step after HoD approval. `content`
 * is the opaque curriculum artefact bundle produced by CE-03..CE-08 — the
 * executor writes it to L1_NODE as a Brain fact and returns the new node's id.
 *
 * `hodApprovalId` is the approval-task UUID recorded by the `human_gate` step.
 * It is carried forward so the publish audit event can reference the approval
 * decision rather than relying on a join.
 */
export const CurriculumPublishInput = z.object({
  tenantId: z.string().uuid(),
  grade: GradeLabel,
  subjects: z.array(z.string().min(1)).min(1),
  termNumber: z.number().int().min(1).max(4),
  academicYear: z.number().int().min(2000).max(2100),
  hodApprovalId: z.string().uuid(),
  /** The full curriculum artefact bundle from CE-03..CE-08. */
  content: z.unknown(),
});
export type CurriculumPublishInput = z.infer<typeof CurriculumPublishInput>;

export const CurriculumPublishResult = z.object({
  brainFactId: z.string().uuid(),
});
export type CurriculumPublishResult = z.infer<typeof CurriculumPublishResult>;

// ---------------------------------------------------------------------------
// brain.tombstone_curriculum_version (compensation)
// ---------------------------------------------------------------------------

/**
 * What the compensation step passes to tombstone a published curriculum version.
 * `brainFactId` is the L1_NODE id returned by `brain.publish_curriculum_version`.
 * `reason` is fixed at `'pipeline_compensation'` — this is not a POPIA-driven
 * tombstone, it is a pipeline rollback because a later step failed after publish
 * succeeded.
 */
export const CurriculumTombstoneInput = z.object({
  tenantId: z.string().uuid(),
  brainFactId: z.string().uuid(),
  reason: z.literal('pipeline_compensation'),
});
export type CurriculumTombstoneInput = z.infer<typeof CurriculumTombstoneInput>;

export const CurriculumTombstoneResult = z.object({
  tombstoneId: z.string().uuid(),
  supersedes: z.string().uuid(),
});
export type CurriculumTombstoneResult = z.infer<typeof CurriculumTombstoneResult>;
