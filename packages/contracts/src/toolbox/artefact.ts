// Toolbox artefact model — Stage 11 step 1.
//
// Eleven artefact types, one per TB agent. Every artefact must carry a CAPS topic
// reference and link to at least one of a lesson or an intervention. The linkage
// constraint is enforced by `ArtefactLinkage`'s `superRefine`, not by convention —
// a parse that omits both `lessonId` and `interventionId` fails at the boundary, the
// same way every other structural invariant in this codebase is checked (rule 8).
//
// VISUAL_BRIEF (TB-11) is text-only: it describes an image the teacher will commission
// from a real source. The system never fabricates imagery presented as real.

import { z } from 'zod';

/** The eleven output types produced by TB-01 through TB-11. */
export const ToolboxArtefactType = z.enum([
  'WORKSHEET',
  'BOARD_DECK',
  'READING_PASSAGE',
  'ASSESSMENT_ITEM',
  'MARKING_MEMO',
  'HOME_LANGUAGE_ADAPTED',
  'ACCESSIBLE_ARTEFACT',
  'REMEDIATION_PACK',
  'EXTENSION_PACK',
  'ACTIVITY_PLAN',
  'VISUAL_BRIEF',
]);
export type ToolboxArtefactType = z.infer<typeof ToolboxArtefactType>;

/** Fixed mapping from artefact type to the producing agent. */
export const ARTEFACT_TYPE_TO_AGENT: Readonly<Record<ToolboxArtefactType, string>> = {
  WORKSHEET: 'TB-01',
  BOARD_DECK: 'TB-02',
  READING_PASSAGE: 'TB-03',
  ASSESSMENT_ITEM: 'TB-04',
  MARKING_MEMO: 'TB-05',
  HOME_LANGUAGE_ADAPTED: 'TB-06',
  ACCESSIBLE_ARTEFACT: 'TB-07',
  REMEDIATION_PACK: 'TB-08',
  EXTENSION_PACK: 'TB-09',
  ACTIVITY_PLAN: 'TB-10',
  VISUAL_BRIEF: 'TB-11',
};

/**
 * Linkage to a CAPS topic plus at least one of a lesson or an intervention.
 * Both can be present (e.g. a remediation worksheet tied to both an intervention plan
 * and the specific lesson where the gap was identified); neither alone is valid.
 */
export const ArtefactLinkage = z
  .object({
    capsTopicId: z.string().min(1),
    lessonId: z.string().uuid().optional(),
    interventionId: z.string().uuid().optional(),
  })
  .superRefine((linkage, ctx) => {
    if (linkage.lessonId === undefined && linkage.interventionId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message:
          'An artefact must link to at least one of lessonId or interventionId. ' +
          'Missing linkage fails validation.',
      });
    }
  });
export type ArtefactLinkage = z.infer<typeof ArtefactLinkage>;

/**
 * The base artefact fields shared by every MOD-04 output.
 *
 * `approvedAt` / `approvedBy` are null until a teacher has reviewed and approved this
 * artefact; the teacher approval gate (step 7) is what sets them. The pipeline must not
 * deliver an artefact to a learner until both are non-null.
 */
export const ToolboxArtefact = z.object({
  artefactId: z.string().uuid(),
  artefactType: ToolboxArtefactType,
  tenantId: z.string().uuid(),
  linkage: ArtefactLinkage,
  /** ISO 639-1 code for the language this artefact is written in. */
  language: z.string().min(2).max(5),
  createdBy: z.string().min(1),
  createdAt: z.string().datetime(),
  approvedAt: z.string().datetime().nullable(),
  approvedBy: z.string().min(1).nullable(),
});
export type ToolboxArtefact = z.infer<typeof ToolboxArtefact>;

/**
 * A VISUAL_BRIEF (TB-11) is a written description only — no image bytes, no generative
 * image call. The `pedagogicalPurpose` field forces the brief to name what concept or
 * skill the image must serve, not merely what it should look like.
 */
export const VisualBrief = ToolboxArtefact.extend({
  artefactType: z.literal('VISUAL_BRIEF'),
  brief: z.string().min(1),
  pedagogicalPurpose: z.string().min(1),
});
export type VisualBrief = z.infer<typeof VisualBrief>;
