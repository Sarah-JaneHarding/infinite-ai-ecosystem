// Stage 08 step 6 — Export surface contracts.
//
// The six artefact types CE-03 through CE-07 produce can be exported in five formats.
// PDF and DOCX are rendered against the school's ratified template; LTI, Google
// Classroom and Microsoft Teams are publication channels — they wrap the DOCX or PDF
// and push it to an external LMS.
//
// Like every other contract in MOD-01, these are "empty vessels": the renderers exist
// but return `needs_template` until a school's TemplateDefinition is ratified in L0
// (OQ-003). The dispatcher routes to the appropriate renderer on the basis of format;
// the renderer itself returns the job status.

import { z } from 'zod';

import { ArtefactType } from './template.js';

// ---------------------------------------------------------------------------
// Format and channel enums
// ---------------------------------------------------------------------------

export const ExportFormat = z.enum([
  'PDF',
  'DOCX',
  'LTI_DEEPLINK',
  'GOOGLE_CLASSROOM',
  'MICROSOFT_TEAMS',
]);
export type ExportFormat = z.infer<typeof ExportFormat>;

/**
 * Binary render formats produce a downloadable file. Publication channels
 * consume a DOCX (the canonical form) and push it into an external LMS.
 */
export const BINARY_FORMATS: readonly ExportFormat[] = ['PDF', 'DOCX'] as const;
export const PUBLICATION_CHANNELS: readonly ExportFormat[] = [
  'LTI_DEEPLINK',
  'GOOGLE_CLASSROOM',
  'MICROSOFT_TEAMS',
] as const;

// ---------------------------------------------------------------------------
// Job status
// ---------------------------------------------------------------------------

export const ExportJobStatus = z.enum([
  'queued',
  'rendering',
  'publishing',
  'complete',
  'failed',
  'needs_template',
]);
export type ExportJobStatus = z.infer<typeof ExportJobStatus>;

// ---------------------------------------------------------------------------
// Publication target (required for channel formats, forbidden for binary)
// ---------------------------------------------------------------------------

export const PublicationTarget = z.object({
  /** External LMS course or class identifier. */
  destinationId: z.string().min(1),
  /**
   * Deep-link return URL for LTI 1.3 launches. Required for LTI_DEEPLINK;
   * ignored (and omitted) for Google Classroom and Teams.
   */
  returnUrl: z.string().url().optional(),
});
export type PublicationTarget = z.infer<typeof PublicationTarget>;

// ---------------------------------------------------------------------------
// Export request
// ---------------------------------------------------------------------------

export const ExportRequest = z
  .object({
    artefactId: z.string().min(1),
    artefactType: ArtefactType,
    format: ExportFormat,
    tenantId: z.string().uuid(),
    /** The authenticated user requesting the export — for audit purposes only. */
    requestedBy: z.string().min(1),
    /**
     * Required when format is a publication channel. Must be absent for PDF and DOCX
     * (binary exports are downloaded, not pushed).
     */
    publicationTarget: PublicationTarget.optional(),
  })
  .superRefine((req, ctx) => {
    const isChannel = (PUBLICATION_CHANNELS as readonly string[]).includes(req.format);
    if (isChannel && req.publicationTarget === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['publicationTarget'],
        message: `publicationTarget is required for channel format ${req.format}.`,
      });
    }
    if (!isChannel && req.publicationTarget !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['publicationTarget'],
        message: `publicationTarget must be absent for binary format ${req.format}.`,
      });
    }
  });
export type ExportRequest = z.infer<typeof ExportRequest>;

// ---------------------------------------------------------------------------
// Export job (the async result, persisted in L4)
// ---------------------------------------------------------------------------

export const ExportJob = z.object({
  jobId: z.string().uuid(),
  artefactId: z.string().min(1),
  artefactType: ArtefactType,
  format: ExportFormat,
  status: ExportJobStatus,
  /** Signed download URL — present only when status is 'complete' and format is binary. */
  downloadUrl: z.string().url().optional(),
  /** LTI or LMS deep-link URL — present when status is 'complete' and format is a channel. */
  publicationUrl: z.string().url().optional(),
  error: z.string().optional(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});
export type ExportJob = z.infer<typeof ExportJob>;

// ---------------------------------------------------------------------------
// Export result (synchronous dispatch response)
// ---------------------------------------------------------------------------

export const ExportResult = z.discriminatedUnion('status', [
  z.object({ status: z.literal('accepted'), job: ExportJob }),
  z.object({
    status: z.literal('needs_template'),
    artefactType: ArtefactType,
    detail: z.string().min(1),
  }),
  z.object({
    status: z.literal('needs_input'),
    detail: z.string().min(1),
  }),
]);
export type ExportResult = z.infer<typeof ExportResult>;
