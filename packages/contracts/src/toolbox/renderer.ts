// Toolbox renderer contract — Stage 11 step 1.
//
// "Build the artefact model and renderer first: a structured artefact type per output,
// rendered to the school's templates for print, PDF, DOCX and slides."
//
// `dispatchRender` is the single dispatch point: it checks whether the requested format
// is supported for the artefact type, checks whether a school template is present, and
// either accepts the job or returns a structured refusal. Like MOD-01's ExportResult,
// the result is synchronous — the actual render runs in the job queue; this contract
// only governs the dispatch decision.

import { z } from 'zod';

import { ToolboxArtefactType } from './artefact.js';

export const ToolboxOutputFormat = z.enum(['PRINT_HTML', 'PDF', 'DOCX', 'SLIDES']);
export type ToolboxOutputFormat = z.infer<typeof ToolboxOutputFormat>;

/**
 * Which formats each artefact type supports.
 * BOARD_DECK renders only to SLIDES (it is a deck, not a document).
 * VISUAL_BRIEF renders only to PRINT_HTML (it is text-only; no binary renderers are invoked).
 */
export const FORMAT_SUPPORT: Readonly<
  Record<ToolboxArtefactType, readonly ToolboxOutputFormat[]>
> = {
  WORKSHEET: ['PRINT_HTML', 'PDF', 'DOCX'],
  BOARD_DECK: ['SLIDES'],
  READING_PASSAGE: ['PRINT_HTML', 'PDF', 'DOCX'],
  ASSESSMENT_ITEM: ['PRINT_HTML', 'PDF', 'DOCX'],
  MARKING_MEMO: ['PDF', 'DOCX'],
  HOME_LANGUAGE_ADAPTED: ['PRINT_HTML', 'PDF', 'DOCX'],
  ACCESSIBLE_ARTEFACT: ['PRINT_HTML', 'PDF', 'DOCX'],
  REMEDIATION_PACK: ['PRINT_HTML', 'PDF', 'DOCX'],
  EXTENSION_PACK: ['PRINT_HTML', 'PDF', 'DOCX'],
  ACTIVITY_PLAN: ['PRINT_HTML', 'PDF', 'DOCX'],
  VISUAL_BRIEF: ['PRINT_HTML'],
};

export const RenderRequest = z.object({
  artefact: z.object({
    artefactId: z.string().uuid(),
    artefactType: ToolboxArtefactType,
    tenantId: z.string().uuid(),
  }),
  format: ToolboxOutputFormat,
  /** The school's ratified template version. Absent means no template has been ratified. */
  templateVersion: z.string().min(1).optional(),
  requestedBy: z.string().min(1),
});
export type RenderRequest = z.infer<typeof RenderRequest>;

export const RenderResult = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('accepted'),
    jobId: z.string().uuid(),
    artefactId: z.string().uuid(),
    format: ToolboxOutputFormat,
  }),
  z.object({
    status: z.literal('needs_template'),
    artefactType: ToolboxArtefactType,
    detail: z.string().min(1),
  }),
  z.object({
    status: z.literal('format_not_supported'),
    artefactType: ToolboxArtefactType,
    format: ToolboxOutputFormat,
    supportedFormats: z.array(ToolboxOutputFormat).min(1),
  }),
]);
export type RenderResult = z.infer<typeof RenderResult>;

/**
 * Dispatches a render request. Returns `format_not_supported` before touching any
 * renderer when the type does not support the format; returns `needs_template` when no
 * school template is available; otherwise returns `accepted` with a fresh job ID.
 */
export function dispatchRender(request: RenderRequest): RenderResult {
  const supported = FORMAT_SUPPORT[request.artefact.artefactType];
  if (!(supported as readonly string[]).includes(request.format)) {
    return {
      status: 'format_not_supported',
      artefactType: request.artefact.artefactType,
      format: request.format,
      supportedFormats: [...supported],
    };
  }
  if (request.templateVersion === undefined) {
    return {
      status: 'needs_template',
      artefactType: request.artefact.artefactType,
      detail:
        `No ratified template version supplied for ${request.artefact.artefactType}. ` +
        `A school template must be loaded into L0 before rendering.`,
    };
  }
  return {
    status: 'accepted',
    jobId: crypto.randomUUID(),
    artefactId: request.artefact.artefactId,
    format: request.format,
  };
}
