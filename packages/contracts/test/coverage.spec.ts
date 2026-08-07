// CE-09 Coverage Auditor contract type tests — Stage 08 step 5.
//
// These tests lock down the structural rules that prevent drift audits from running
// without a ratified term plan, and that the needs_input vocabulary is constrained to
// the two document kinds CE-09 actually depends on.

import { describe, expect, it } from 'vitest';

import { CE09Input, CoverageAuditResult, DriftKind } from '../src/curriculum/coverage.js';

describe('CE09Input', () => {
  const validInput = {
    grade: '7',
    subject: 'Mathematics',
    termNumber: 1,
    academicYear: 2026,
    tenantId: '00000000-0000-0000-0000-000000000001',
  };

  it('accepts a complete, valid CE-09 input', () => {
    expect(CE09Input.safeParse(validInput).success).toBe(true);
  });

  it('accepts Grade R — Foundation Phase audits are supported', () => {
    expect(CE09Input.safeParse({ ...validInput, grade: 'R' }).success).toBe(true);
  });

  it('accepts Grade 12', () => {
    expect(CE09Input.safeParse({ ...validInput, grade: '12' }).success).toBe(true);
  });

  it('rejects a term number above 4', () => {
    expect(CE09Input.safeParse({ ...validInput, termNumber: 5 }).success).toBe(false);
  });

  it('rejects a term number of zero', () => {
    expect(CE09Input.safeParse({ ...validInput, termNumber: 0 }).success).toBe(false);
  });

  it('rejects an academic year below 2000', () => {
    expect(CE09Input.safeParse({ ...validInput, academicYear: 1999 }).success).toBe(
      false,
    );
  });

  it('rejects an academic year above 2100', () => {
    expect(CE09Input.safeParse({ ...validInput, academicYear: 2101 }).success).toBe(
      false,
    );
  });

  it('rejects a malformed tenant UUID', () => {
    expect(CE09Input.safeParse({ ...validInput, tenantId: 'bad-uuid' }).success).toBe(
      false,
    );
  });

  it('rejects an empty subject', () => {
    expect(CE09Input.safeParse({ ...validInput, subject: '' }).success).toBe(false);
  });

  it('rejects Grade 13 — only R through 12 are valid', () => {
    expect(CE09Input.safeParse({ ...validInput, grade: '13' }).success).toBe(false);
  });
});

describe('DriftKind', () => {
  it('accepts all four drift kinds', () => {
    for (const kind of [
      'planned_not_taught',
      'taught_not_planned',
      'planned_not_assessed',
      'assessed_not_planned',
    ]) {
      expect(DriftKind.safeParse(kind).success).toBe(true);
    }
  });

  it('rejects an unrecognised drift kind', () => {
    expect(DriftKind.safeParse('not_completed').success).toBe(false);
  });
});

describe('CoverageAuditResult — needs_input is a first-class outcome', () => {
  it('accepts a needs_input result naming a missing term plan', () => {
    const result = CoverageAuditResult.safeParse({
      status: 'needs_input',
      grade: '7',
      subject: 'Mathematics',
      termNumber: 1,
      missing: [
        {
          documentKind: 'TERM_PLAN',
          detail: 'Term 1 Grade 7 Mathematics',
          why: 'No ratified term plan exists for this grade and subject.',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a needs_input result naming a missing episode log', () => {
    const result = CoverageAuditResult.safeParse({
      status: 'needs_input',
      grade: '9',
      subject: 'Life Sciences',
      termNumber: 2,
      missing: [
        {
          documentKind: 'L2_EPISODE_LOG',
          detail: null,
          why: 'No L2 episode records exist for this term — lessons have not yet been logged.',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a needs_input result with both TERM_PLAN and L2_EPISODE_LOG missing', () => {
    const result = CoverageAuditResult.safeParse({
      status: 'needs_input',
      grade: '5',
      subject: 'Social Sciences',
      termNumber: 3,
      missing: [
        {
          documentKind: 'TERM_PLAN',
          detail: null,
          why: 'No ratified term plan.',
        },
        {
          documentKind: 'L2_EPISODE_LOG',
          detail: null,
          why: 'No episode log.',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a needs_input result with an empty missing array', () => {
    expect(
      CoverageAuditResult.safeParse({
        status: 'needs_input',
        grade: '7',
        subject: 'Mathematics',
        termNumber: 1,
        missing: [],
      }).success,
    ).toBe(false);
  });

  it('rejects a needs_input result with an unrecognised documentKind', () => {
    expect(
      CoverageAuditResult.safeParse({
        status: 'needs_input',
        grade: '7',
        subject: 'Mathematics',
        termNumber: 1,
        missing: [{ documentKind: 'UNIT_BLUEPRINT', detail: null, why: 'test' }],
      }).success,
    ).toBe(false);
  });

  it('rejects an unrecognised status', () => {
    expect(CoverageAuditResult.safeParse({ status: 'pending', grade: '7' }).success).toBe(
      false,
    );
  });

  it('accepts an ok result with a complete coverage audit', () => {
    const result = CoverageAuditResult.safeParse({
      status: 'ok',
      audit: {
        grade: '7',
        subject: 'Mathematics',
        termNumber: 1,
        academicYear: 2026,
        coverageRatePct: 85.5,
        driftItems: [
          {
            topicId: 'alg-1-2',
            topicDescription: 'Linear equations: graphical method',
            kind: 'planned_not_taught',
            weekNumber: 8,
            detail: 'No episode record found for this topic in week 8.',
          },
        ],
        sourceDocuments: [
          {
            documentId: 'term-plan-gr7-maths-t1-2026',
            documentVersion: '1.0',
            clause: 'Term 1 ratified plan',
            ratifiedBy: 'hod-001',
          },
        ],
        auditedAt: '2026-08-07T00:00:00.000Z',
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an ok result with a coverageRatePct above 100', () => {
    expect(
      CoverageAuditResult.safeParse({
        status: 'ok',
        audit: {
          grade: '7',
          subject: 'Mathematics',
          termNumber: 1,
          academicYear: 2026,
          coverageRatePct: 101,
          driftItems: [],
          sourceDocuments: [
            {
              documentId: 'term-plan-gr7-maths-t1-2026',
              documentVersion: '1.0',
              clause: 'Term 1 ratified plan',
              ratifiedBy: null,
            },
          ],
          auditedAt: '2026-08-07T00:00:00.000Z',
        },
      }).success,
    ).toBe(false);
  });

  it('rejects an ok result with no source documents', () => {
    expect(
      CoverageAuditResult.safeParse({
        status: 'ok',
        audit: {
          grade: '7',
          subject: 'Mathematics',
          termNumber: 1,
          academicYear: 2026,
          coverageRatePct: 80,
          driftItems: [],
          sourceDocuments: [],
          auditedAt: '2026-08-07T00:00:00.000Z',
        },
      }).success,
    ).toBe(false);
  });
});
