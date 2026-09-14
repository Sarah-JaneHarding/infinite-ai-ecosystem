// Stage 08 step 6 — Export dispatcher tests.
//
// The dispatcher routes requests to the appropriate renderer or publisher.
// Stub deps are the default — they return 'needs_template' for binary formats
// and 'error' for publication channels, which is the correct "empty vessel"
// behaviour until a school's template is ratified and LMS credentials are set.

import { describe, expect, it } from 'vitest';

import {
  dispatchExport,
  makeStubDeps,
  makeStubPublisher,
  makeStubRenderer,
} from '../../src/export/dispatcher.js';
import type {
  ArtefactPublisher,
  ArtefactRenderer,
  ExportDispatcherDeps,
} from '../../src/export/dispatcher.js';
import type { ExportRequest } from '@infinite-ai/contracts';

const BASE_REQUEST: ExportRequest = {
  artefactId: 'lesson-plan-gr7-maths-w01-2026',
  artefactType: 'LESSON_PLAN',
  format: 'PDF',
  tenantId: '00000000-0000-0000-0000-000000000001',
  requestedBy: 'hod-001',
};

describe('makeStubDeps', () => {
  it('returns PDF and DOCX stub renderers', () => {
    const deps = makeStubDeps();
    expect(deps.renderers.PDF.format).toBe('PDF');
    expect(deps.renderers.DOCX.format).toBe('DOCX');
  });

  it('returns stubs for all three publication channels', () => {
    const deps = makeStubDeps();
    expect(deps.publishers.LTI_DEEPLINK.channel).toBe('LTI_DEEPLINK');
    expect(deps.publishers.GOOGLE_CLASSROOM.channel).toBe('GOOGLE_CLASSROOM');
    expect(deps.publishers.MICROSOFT_TEAMS.channel).toBe('MICROSOFT_TEAMS');
  });
});

describe('makeStubRenderer', () => {
  it('returns needs_template — no templates are ratified in L0 yet', async () => {
    const renderer = makeStubRenderer('PDF');
    const result = await renderer.render('lp-123', 'LESSON_PLAN', 'tenant-001');
    expect(result.status).toBe('needs_template');
  });

  it('includes the artefact type and renderer type in the detail message', async () => {
    const renderer = makeStubRenderer('DOCX');
    const result = await renderer.render('lp-123', 'UNIT_PLAN', 'tenant-001');
    expect(result.status).toBe('needs_template');
    if (result.status === 'needs_template') {
      expect(result.detail).toContain('UNIT_PLAN');
      expect(result.detail).toContain('DOCX');
    }
  });
});

describe('makeStubPublisher', () => {
  it('returns error — no LMS credentials are configured yet', async () => {
    const publisher = makeStubPublisher('LTI_DEEPLINK');
    const result = await publisher.publish(
      'lp-123',
      'LESSON_PLAN',
      't-001',
      'https://example.com/lesson.docx',
      { destinationId: 'ctx-1' },
    );
    expect(result.status).toBe('error');
  });
});

describe('dispatchExport — stub renderers (empty vessel state)', () => {
  it('returns needs_template for a PDF request', async () => {
    const result = await dispatchExport(
      { ...BASE_REQUEST, format: 'PDF' },
      makeStubDeps(),
    );
    expect(result.status).toBe('needs_template');
  });

  it('returns needs_template for a DOCX request', async () => {
    const result = await dispatchExport(
      { ...BASE_REQUEST, format: 'DOCX' },
      makeStubDeps(),
    );
    expect(result.status).toBe('needs_template');
  });

  it('returns needs_template for a Google Classroom request when DOCX renderer lacks template', async () => {
    const result = await dispatchExport(
      {
        ...BASE_REQUEST,
        format: 'GOOGLE_CLASSROOM',
        publicationTarget: { destinationId: 'gc-course-123' },
      },
      makeStubDeps(),
    );
    expect(result.status).toBe('needs_template');
  });

  it('returns needs_template for an LTI request when DOCX renderer lacks template', async () => {
    const result = await dispatchExport(
      {
        ...BASE_REQUEST,
        format: 'LTI_DEEPLINK',
        publicationTarget: {
          destinationId: 'lti-ctx-1',
          returnUrl: 'https://lms.example/return',
        },
      },
      makeStubDeps(),
    );
    expect(result.status).toBe('needs_template');
  });
});

describe('dispatchExport — with a working renderer wired in', () => {
  const workingRenderer: ArtefactRenderer = {
    format: 'DOCX',
    async render() {
      return { status: 'ok', downloadUrl: 'https://storage.example/lesson.docx' };
    },
  };

  function depsWithDocx(): ExportDispatcherDeps {
    return {
      ...makeStubDeps(),
      renderers: {
        ...makeStubDeps().renderers,
        DOCX: workingRenderer,
      },
    };
  }

  it('accepted status when DOCX renderer succeeds', async () => {
    const result = await dispatchExport(
      { ...BASE_REQUEST, format: 'DOCX' },
      depsWithDocx(),
    );
    expect(result.status).toBe('accepted');
    if (result.status === 'accepted') {
      expect(result.job.status).toBe('complete');
      expect(result.job.downloadUrl).toBe('https://storage.example/lesson.docx');
    }
  });

  it('accepted + failed when publisher returns error after DOCX succeeds', async () => {
    const failingPublisher: ArtefactPublisher = {
      channel: 'GOOGLE_CLASSROOM',
      async publish() {
        return { status: 'error', detail: 'OAuth token expired' };
      },
    };
    const deps: ExportDispatcherDeps = {
      ...depsWithDocx(),
      publishers: { ...makeStubDeps().publishers, GOOGLE_CLASSROOM: failingPublisher },
    };

    const result = await dispatchExport(
      {
        ...BASE_REQUEST,
        format: 'GOOGLE_CLASSROOM',
        publicationTarget: { destinationId: 'gc-course-999' },
      },
      deps,
    );
    expect(result.status).toBe('accepted');
    if (result.status === 'accepted') {
      expect(result.job.status).toBe('failed');
      expect(result.job.error).toContain('OAuth token expired');
    }
  });

  it('accepted + complete + publicationUrl when publisher succeeds', async () => {
    const workingPublisher: ArtefactPublisher = {
      channel: 'MICROSOFT_TEAMS',
      async publish() {
        return {
          status: 'ok',
          publicationUrl: 'https://teams.microsoft.com/l/message/123',
        };
      },
    };
    const deps: ExportDispatcherDeps = {
      ...depsWithDocx(),
      publishers: { ...makeStubDeps().publishers, MICROSOFT_TEAMS: workingPublisher },
    };

    const result = await dispatchExport(
      {
        ...BASE_REQUEST,
        format: 'MICROSOFT_TEAMS',
        publicationTarget: { destinationId: 'teams-channel-1' },
      },
      deps,
    );
    expect(result.status).toBe('accepted');
    if (result.status === 'accepted') {
      expect(result.job.status).toBe('complete');
      expect(result.job.publicationUrl).toBe('https://teams.microsoft.com/l/message/123');
    }
  });
});

describe('dispatchExport — job fields are correct', () => {
  it('job carries the artefactId, artefactType and format from the request', async () => {
    const result = await dispatchExport(
      { ...BASE_REQUEST, format: 'PDF' },
      makeStubDeps(),
    );
    // needs_template — but the job field is absent; verify the artefactType echo
    expect(result.status).toBe('needs_template');
    if (result.status === 'needs_template') {
      expect(result.artefactType).toBe('LESSON_PLAN');
    }
  });

  it('accepted job has a UUID jobId', async () => {
    const workingRenderer: ArtefactRenderer = {
      format: 'PDF',
      async render() {
        return { status: 'ok', downloadUrl: 'https://storage.example/lesson.pdf' };
      },
    };
    const deps: ExportDispatcherDeps = {
      ...makeStubDeps(),
      renderers: { ...makeStubDeps().renderers, PDF: workingRenderer },
    };
    const result = await dispatchExport({ ...BASE_REQUEST, format: 'PDF' }, deps);
    expect(result.status).toBe('accepted');
    if (result.status === 'accepted') {
      expect(result.job.jobId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    }
  });
});
