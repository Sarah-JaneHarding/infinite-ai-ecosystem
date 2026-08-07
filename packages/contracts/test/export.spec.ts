// Stage 08 step 6 — Export surface contract tests.
//
// Validates the ExportRequest discriminator (binary formats forbid publicationTarget;
// channel formats require it) and the ExportResult discriminated union.

import { describe, expect, it } from 'vitest';

import {
  ExportFormat,
  ExportJob,
  ExportJobStatus,
  ExportRequest,
  ExportResult,
} from '../src/curriculum/export.js';

describe('ExportFormat', () => {
  it('accepts all five formats', () => {
    for (const fmt of [
      'PDF',
      'DOCX',
      'LTI_DEEPLINK',
      'GOOGLE_CLASSROOM',
      'MICROSOFT_TEAMS',
    ]) {
      expect(ExportFormat.safeParse(fmt).success).toBe(true);
    }
  });

  it('rejects an unrecognised format', () => {
    expect(ExportFormat.safeParse('HTML').success).toBe(false);
  });
});

describe('ExportJobStatus', () => {
  it('accepts all six statuses', () => {
    for (const s of [
      'queued',
      'rendering',
      'publishing',
      'complete',
      'failed',
      'needs_template',
    ]) {
      expect(ExportJobStatus.safeParse(s).success).toBe(true);
    }
  });
});

describe('ExportRequest', () => {
  const base = {
    artefactId: 'lesson-plan-gr7-maths-w01-2026',
    artefactType: 'LESSON_PLAN',
    tenantId: '00000000-0000-0000-0000-000000000001',
    requestedBy: 'hod-001',
  };

  it('accepts a PDF request with no publicationTarget', () => {
    expect(ExportRequest.safeParse({ ...base, format: 'PDF' }).success).toBe(true);
  });

  it('accepts a DOCX request with no publicationTarget', () => {
    expect(ExportRequest.safeParse({ ...base, format: 'DOCX' }).success).toBe(true);
  });

  it('rejects a PDF request that includes publicationTarget', () => {
    expect(
      ExportRequest.safeParse({
        ...base,
        format: 'PDF',
        publicationTarget: { destinationId: 'course-123' },
      }).success,
    ).toBe(false);
  });

  it('accepts a Google Classroom request with a publicationTarget', () => {
    expect(
      ExportRequest.safeParse({
        ...base,
        format: 'GOOGLE_CLASSROOM',
        publicationTarget: { destinationId: 'gc-course-456' },
      }).success,
    ).toBe(true);
  });

  it('accepts an LTI request with a returnUrl in the target', () => {
    expect(
      ExportRequest.safeParse({
        ...base,
        format: 'LTI_DEEPLINK',
        publicationTarget: {
          destinationId: 'lti-context-789',
          returnUrl: 'https://lms.school.example/lti/return',
        },
      }).success,
    ).toBe(true);
  });

  it('rejects a Google Classroom request with no publicationTarget', () => {
    expect(ExportRequest.safeParse({ ...base, format: 'GOOGLE_CLASSROOM' }).success).toBe(
      false,
    );
  });

  it('rejects a Microsoft Teams request with no publicationTarget', () => {
    expect(ExportRequest.safeParse({ ...base, format: 'MICROSOFT_TEAMS' }).success).toBe(
      false,
    );
  });

  it('rejects a malformed tenant UUID', () => {
    expect(
      ExportRequest.safeParse({ ...base, format: 'PDF', tenantId: 'not-a-uuid' }).success,
    ).toBe(false);
  });

  it('rejects an empty requestedBy', () => {
    expect(
      ExportRequest.safeParse({ ...base, format: 'PDF', requestedBy: '' }).success,
    ).toBe(false);
  });

  it('rejects an invalid artefact type', () => {
    expect(
      ExportRequest.safeParse({ ...base, format: 'PDF', artefactType: 'TIMETABLE' })
        .success,
    ).toBe(false);
  });
});

describe('ExportJob', () => {
  const base = {
    jobId: '00000000-0000-0000-0000-000000000002',
    artefactId: 'lesson-plan-gr7-maths-w01-2026',
    artefactType: 'LESSON_PLAN',
    format: 'PDF',
    status: 'queued',
    createdAt: '2026-08-07T01:00:00.000Z',
  };

  it('accepts a minimal queued job', () => {
    expect(ExportJob.safeParse(base).success).toBe(true);
  });

  it('accepts a complete job with downloadUrl', () => {
    expect(
      ExportJob.safeParse({
        ...base,
        status: 'complete',
        downloadUrl: 'https://storage.school.example/exports/lesson.pdf',
        completedAt: '2026-08-07T01:00:05.000Z',
      }).success,
    ).toBe(true);
  });

  it('accepts a failed job with an error message', () => {
    expect(
      ExportJob.safeParse({
        ...base,
        status: 'failed',
        error: 'Template not found',
        completedAt: '2026-08-07T01:00:01.000Z',
      }).success,
    ).toBe(true);
  });
});

describe('ExportResult', () => {
  it('accepts an accepted result with a job', () => {
    expect(
      ExportResult.safeParse({
        status: 'accepted',
        job: {
          jobId: '00000000-0000-0000-0000-000000000003',
          artefactId: 'lp-123',
          artefactType: 'LESSON_PLAN',
          format: 'PDF',
          status: 'queued',
          createdAt: '2026-08-07T01:00:00.000Z',
        },
      }).success,
    ).toBe(true);
  });

  it('accepts a needs_template result', () => {
    expect(
      ExportResult.safeParse({
        status: 'needs_template',
        artefactType: 'LESSON_PLAN',
        detail: 'No ratified template for LESSON_PLAN.',
      }).success,
    ).toBe(true);
  });

  it('accepts a needs_input result', () => {
    expect(
      ExportResult.safeParse({
        status: 'needs_input',
        detail: 'format: invalid_enum_value',
      }).success,
    ).toBe(true);
  });

  it('rejects an unrecognised status', () => {
    expect(ExportResult.safeParse({ status: 'pending' }).success).toBe(false);
  });
});
