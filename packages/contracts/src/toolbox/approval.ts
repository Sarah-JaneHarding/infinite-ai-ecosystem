// Teacher approval and edit surface — Stage 11 step 7.
//
// Two shapes: the structured edit diff a teacher produces when approving-with-edits
// (ToolboxEditField + ToolboxEditDiff), and the learning signal that is persisted to the
// Brain whenever a teacher makes edits (TeacherEditSignal). Stage 13 reads these signals
// to improve the relevant agent's prompts and few-shot examples.
//
// ToolboxEditDiff is the typed payload for the `editDiff` field of a
// HumanGateDecisionInput (outcome: 'EDITED'). TeacherEditSignal is what
// `toolbox.capture_edit_signal` writes to the Brain.

import { z } from 'zod';

import { ToolboxArtefactType } from './artefact.js';

/**
 * A single field-level change made by a teacher to a generated artefact.
 *
 * `field` uses a JSON-path-style address so the receiving system can locate the changed
 * node without parsing the whole artefact — e.g. `"slides[2].content"` for a deck or
 * `"sections[0].workedExamples[1]"` for a remediation pack.
 */
export const ToolboxEditField = z.object({
  field: z.string().min(1),
  before: z.string().min(1),
  after: z.string().min(1),
});
export type ToolboxEditField = z.infer<typeof ToolboxEditField>;

/**
 * All field-level edits a teacher made in one approval-with-edits session.
 *
 * `totalCharactersChanged` is the sum of `|before.length − after.length|` across all
 * `fieldEdits` — a coarse signal for Stage 13's effort metric.
 * At least one `fieldEdits` entry is required: an EDITED outcome with no edits is a
 * contract violation.
 */
export const ToolboxEditDiff = z.object({
  artefactId: z.string().uuid(),
  artefactType: ToolboxArtefactType,
  editedAt: z.string().datetime(),
  editedBy: z.string().min(1),
  fieldEdits: z.array(ToolboxEditField).min(1),
  totalCharactersChanged: z.number().int().nonnegative(),
});
export type ToolboxEditDiff = z.infer<typeof ToolboxEditDiff>;

/**
 * A learning signal persisted to the Brain when a teacher edits a generated artefact.
 *
 * `agentId` identifies which TB agent produced the artefact so Stage 13 can route the
 * signal to the right agent's prompt improvement loop.
 * `capsTopicId` anchors the signal to the curriculum topic for cross-agent analysis.
 * Brain writes are append-only — this record is never updated or deleted.
 */
export const TeacherEditSignal = z.object({
  signalId: z.string().uuid(),
  tenantId: z.string().uuid(),
  agentId: z.string().min(1),
  artefactId: z.string().uuid(),
  artefactType: ToolboxArtefactType,
  capsTopicId: z.string().min(1),
  editDiff: ToolboxEditDiff,
  capturedAt: z.string().datetime(),
});
export type TeacherEditSignal = z.infer<typeof TeacherEditSignal>;
