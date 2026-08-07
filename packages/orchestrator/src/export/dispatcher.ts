// Stage 08 step 6 — Export dispatcher.
//
// Routes an ExportRequest to the appropriate renderer (PDF, DOCX) or publisher
// (LTI, Google Classroom, Microsoft Teams). Returns an ExportResult synchronously:
// 'accepted' means the job has been queued and a jobId is available; 'needs_template'
// means the school has not yet ratified a TemplateDefinition for this artefact type in L0.
//
// Renderers and publishers are injected so tests can replace them without spawning
// a real queue. Production wires in the BullMQ-backed implementations from apps/worker.

import crypto from 'node:crypto';

import {
  BINARY_FORMATS,
  ExportJob,
  ExportRequest,
  ExportResult,
  type ExportFormat,
  type ExportJobStatus,
  type PublicationTarget,
} from '@infinite-ai/contracts';

import type { ArtefactType } from '@infinite-ai/contracts';

// ---------------------------------------------------------------------------
// Renderer / publisher interfaces
// ---------------------------------------------------------------------------

/**
 * A renderer converts a structured artefact payload (serialised as JSON) into a
 * downloadable binary. It returns `needs_template` when no ratified template exists
 * for this artefact type in the tenant's L0, which is the only safe failure mode —
 * generating output that does not conform to the school's template is not an option.
 */
export interface ArtefactRenderer {
  readonly format: 'PDF' | 'DOCX';
  render(
    artefactId: string,
    artefactType: ArtefactType,
    tenantId: string,
  ): Promise<
    | { readonly status: 'ok'; readonly downloadUrl: string }
    | { readonly status: 'needs_template'; readonly detail: string }
    | { readonly status: 'error'; readonly detail: string }
  >;
}

/**
 * A publisher pushes the canonical DOCX rendering to an external LMS and returns a
 * deep-link URL. The DOCX is generated first (from the DOCX renderer); this interface
 * consumes the resulting downloadUrl and handles LMS-specific OAuth / REST calls.
 */
export interface ArtefactPublisher {
  readonly channel: 'LTI_DEEPLINK' | 'GOOGLE_CLASSROOM' | 'MICROSOFT_TEAMS';
  publish(
    artefactId: string,
    artefactType: ArtefactType,
    tenantId: string,
    docxDownloadUrl: string,
    target: PublicationTarget,
  ): Promise<
    | { readonly status: 'ok'; readonly publicationUrl: string }
    | { readonly status: 'error'; readonly detail: string }
  >;
}

// ---------------------------------------------------------------------------
// Stub implementations (returned by makeStubRenderers / makeStubPublishers)
// ---------------------------------------------------------------------------

/** Stub renderer used until a real PDF/DOCX library is wired and templates are ratified. */
export function makeStubRenderer(format: 'PDF' | 'DOCX'): ArtefactRenderer {
  return {
    format,
    async render(_artefactId, artefactType) {
      return {
        status: 'needs_template',
        detail:
          `No ratified TemplateDefinition found for artefact type '${artefactType}' — ` +
          `the ${format} renderer cannot produce output until the school's template is ` +
          `ratified into L0 (see docs/OPEN_QUESTIONS.md OQ-003). ` +
          `Install a PDF/DOCX rendering library and ratify a template to unblock.`,
      };
    },
  };
}

/** Stub publisher used until LMS credentials and API clients are configured. */
export function makeStubPublisher(
  channel: 'LTI_DEEPLINK' | 'GOOGLE_CLASSROOM' | 'MICROSOFT_TEAMS',
): ArtefactPublisher {
  return {
    channel,
    async publish(_artefactId, _artefactType, _tenantId, _docxUrl, _target) {
      return {
        status: 'error',
        detail:
          `${channel} publisher is not yet configured for this tenant. ` +
          `Provide LMS credentials and register this tenant's integration first.`,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export interface ExportDispatcherDeps {
  renderers: Record<'PDF' | 'DOCX', ArtefactRenderer>;
  publishers: Record<
    'LTI_DEEPLINK' | 'GOOGLE_CLASSROOM' | 'MICROSOFT_TEAMS',
    ArtefactPublisher
  >;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeJob(
  req: ExportRequest,
  status: ExportJobStatus,
  extra?: Partial<ExportJob>,
): ExportJob {
  return ExportJob.parse({
    jobId: crypto.randomUUID(),
    artefactId: req.artefactId,
    artefactType: req.artefactType,
    format: req.format,
    status,
    createdAt: nowIso(),
    ...extra,
  });
}

/**
 * Dispatches an export request. Binary formats (PDF, DOCX) are rendered immediately
 * via the injected renderer; publication channels first render to DOCX then push via
 * the injected publisher. Returns a synchronous ExportResult — callers queue the job
 * in BullMQ themselves if they want true async.
 */
export async function dispatchExport(
  req: ExportRequest,
  deps: ExportDispatcherDeps,
): Promise<ExportResult> {
  const parsed = ExportRequest.safeParse(req);
  if (!parsed.success) {
    return ExportResult.parse({
      status: 'needs_input',
      detail: parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; '),
    });
  }

  const { format } = req;

  if ((BINARY_FORMATS as readonly ExportFormat[]).includes(format)) {
    const renderer = deps.renderers[format as 'PDF' | 'DOCX'];
    const outcome = await renderer.render(req.artefactId, req.artefactType, req.tenantId);

    if (outcome.status === 'needs_template') {
      return ExportResult.parse({
        status: 'needs_template',
        artefactType: req.artefactType,
        detail: outcome.detail,
      });
    }
    if (outcome.status === 'error') {
      const job = makeJob(req, 'failed', {
        error: outcome.detail,
        completedAt: nowIso(),
      });
      return ExportResult.parse({ status: 'accepted', job });
    }

    const job = makeJob(req, 'complete', {
      downloadUrl: outcome.downloadUrl,
      completedAt: nowIso(),
    });
    return ExportResult.parse({ status: 'accepted', job });
  }

  // Publication channel — render to DOCX first, then publish.
  const channel = format as 'LTI_DEEPLINK' | 'GOOGLE_CLASSROOM' | 'MICROSOFT_TEAMS';
  const docxOutcome = await deps.renderers.DOCX.render(
    req.artefactId,
    req.artefactType,
    req.tenantId,
  );

  if (docxOutcome.status === 'needs_template') {
    return ExportResult.parse({
      status: 'needs_template',
      artefactType: req.artefactType,
      detail: docxOutcome.detail,
    });
  }
  if (docxOutcome.status === 'error') {
    const job = makeJob(req, 'failed', {
      error: docxOutcome.detail,
      completedAt: nowIso(),
    });
    return ExportResult.parse({ status: 'accepted', job });
  }

  const publisher = deps.publishers[channel];
  const pubOutcome = await publisher.publish(
    req.artefactId,
    req.artefactType,
    req.tenantId,
    docxOutcome.downloadUrl,
    req.publicationTarget!,
  );

  if (pubOutcome.status === 'error') {
    const job = makeJob(req, 'failed', {
      error: pubOutcome.detail,
      completedAt: nowIso(),
    });
    return ExportResult.parse({ status: 'accepted', job });
  }

  const job = makeJob(req, 'complete', {
    publicationUrl: pubOutcome.publicationUrl,
    completedAt: nowIso(),
  });
  return ExportResult.parse({ status: 'accepted', job });
}

/**
 * Builds a deps object with all-stub renderers and publishers. Used in tests and
 * as the default until the school's template is ratified and LMS credentials are set.
 */
export function makeStubDeps(): ExportDispatcherDeps {
  return {
    renderers: {
      PDF: makeStubRenderer('PDF'),
      DOCX: makeStubRenderer('DOCX'),
    },
    publishers: {
      LTI_DEEPLINK: makeStubPublisher('LTI_DEEPLINK'),
      GOOGLE_CLASSROOM: makeStubPublisher('GOOGLE_CLASSROOM'),
      MICROSOFT_TEAMS: makeStubPublisher('MICROSOFT_TEAMS'),
    },
  };
}
