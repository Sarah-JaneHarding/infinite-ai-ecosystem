import { describe, expect, it } from 'vitest';

import { runQualityChecks } from '../../src/quality/quality-sentinel.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const RUN_ID = '00000000-0000-0000-0000-000000000020';
const TODAY = '2026-08-07';

function baseInput(
  overrides: Partial<{
    domain:
      | 'ATTENDANCE'
      | 'ASSESSMENT'
      | 'BEHAVIOUR'
      | 'WELLBEING'
      | 'DEMOGRAPHIC'
      | 'SCREENER';
    sampleRecords: Record<string, unknown>[];
  }> = {},
) {
  return {
    tenantId: TENANT_ID,
    runId: RUN_ID,
    domain: overrides.domain ?? ('ATTENDANCE' as const),
    sampleRecords: overrides.sampleRecords ?? [
      { learnerToken: 'tkn_001', attendanceStatus: 'PRESENT', occurredAt: TODAY },
      { learnerToken: 'tkn_002', attendanceStatus: 'ABSENT', occurredAt: TODAY },
    ],
  };
}

function perfectAttendance(n = 3) {
  const statuses = ['PRESENT', 'ABSENT', 'LATE'] as const;
  return Array.from({ length: n }, (_, i) => ({
    learnerToken: `tkn_${String(i + 1).padStart(3, '0')}`,
    attendanceStatus: statuses[i % 3],
    occurredAt: TODAY,
  }));
}

// ---------------------------------------------------------------------------
// ok status — perfect quality
// ---------------------------------------------------------------------------

describe('runQualityChecks — perfect quality', () => {
  it('returns ok with score=100 and no issues when all records are valid', () => {
    const result = runQualityChecks(
      baseInput({ sampleRecords: perfectAttendance(3) }),
      TODAY,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.qualityScore).toBe(100);
      expect(result.blockedDownstream).toBe(false);
      expect(result.totalRecords).toBe(3);
      expect(result.rejectedRecords).toBe(0);
      expect(result.issues).toHaveLength(0);
    }
  });

  it('counts totalRecords correctly for a larger batch', () => {
    const result = runQualityChecks(
      baseInput({ sampleRecords: perfectAttendance(10) }),
      TODAY,
    );
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.totalRecords).toBe(10);
      expect(result.rejectedRecords).toBe(0);
      expect(result.qualityScore).toBe(100);
    }
  });
});

// ---------------------------------------------------------------------------
// needs_input — empty records
// ---------------------------------------------------------------------------

describe('runQualityChecks — needs_input status', () => {
  it('returns needs_input when sampleRecords is empty', () => {
    const result = runQualityChecks(
      { tenantId: TENANT_ID, runId: RUN_ID, domain: 'ATTENDANCE', sampleRecords: [] },
      TODAY,
    );
    expect(result.status).toBe('needs_input');
  });
});

// ---------------------------------------------------------------------------
// MISSING_FIELD — required field checks
// ---------------------------------------------------------------------------

describe('runQualityChecks — missing required fields', () => {
  it('raises MISSING_FIELD ERROR for a missing attendanceStatus', () => {
    const result = runQualityChecks(
      baseInput({
        sampleRecords: [
          { learnerToken: 'tkn_001', occurredAt: TODAY },
          { learnerToken: 'tkn_002', occurredAt: TODAY },
        ],
      }),
      TODAY,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      const missing = result.issues.filter(
        (i) => i.kind === 'MISSING_FIELD' && i.field === 'attendanceStatus',
      );
      expect(missing.length).toBeGreaterThanOrEqual(2);
      expect(missing.every((i) => i.severity === 'ERROR')).toBe(true);
    }
  });

  it('raises MISSING_FIELD for a missing scorePercent in ASSESSMENT domain', () => {
    const result = runQualityChecks(
      {
        tenantId: TENANT_ID,
        runId: RUN_ID,
        domain: 'ASSESSMENT',
        sampleRecords: [
          { learnerToken: 'tkn_001', subjectCode: 'MATH', occurredAt: TODAY },
        ],
      },
      TODAY,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(
        result.issues.some(
          (i) => i.kind === 'MISSING_FIELD' && i.field === 'scorePercent',
        ),
      ).toBe(true);
    }
  });

  it('rejects every record missing a required field, lowering the quality score', () => {
    // 5 records; records 2-5 missing attendanceStatus → 4 rejected → score = 20
    const result = runQualityChecks(
      baseInput({
        sampleRecords: [
          { learnerToken: 'tkn_001', attendanceStatus: 'PRESENT', occurredAt: TODAY },
          { learnerToken: 'tkn_002', occurredAt: TODAY },
          { learnerToken: 'tkn_003', occurredAt: TODAY },
          { learnerToken: 'tkn_004', occurredAt: TODAY },
          { learnerToken: 'tkn_005', occurredAt: TODAY },
        ],
      }),
      TODAY,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.totalRecords).toBe(5);
      expect(result.rejectedRecords).toBe(4);
      expect(result.qualityScore).toBe(20);
      expect(result.blockedDownstream).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Quality score formula
// ---------------------------------------------------------------------------

describe('runQualityChecks — quality score formula', () => {
  it('score = round(100 * (total − rejected) / total): 4 total, 2 rejected → 50', () => {
    const result = runQualityChecks(
      baseInput({
        sampleRecords: [
          { learnerToken: 'tkn_001', attendanceStatus: 'PRESENT', occurredAt: TODAY },
          { learnerToken: 'tkn_002', attendanceStatus: 'ABSENT', occurredAt: TODAY },
          { learnerToken: 'tkn_003', occurredAt: TODAY }, // missing status
          { learnerToken: 'tkn_004', occurredAt: TODAY }, // missing status
        ],
      }),
      TODAY,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.totalRecords).toBe(4);
      expect(result.rejectedRecords).toBe(2);
      expect(result.qualityScore).toBe(50);
    }
  });

  it('score >= 60 does not block downstream', () => {
    // 5 records; 2 rejected → score = 60 → not blocked
    const result = runQualityChecks(
      baseInput({
        sampleRecords: [
          { learnerToken: 'tkn_001', attendanceStatus: 'PRESENT', occurredAt: TODAY },
          { learnerToken: 'tkn_002', attendanceStatus: 'ABSENT', occurredAt: TODAY },
          { learnerToken: 'tkn_003', attendanceStatus: 'LATE', occurredAt: TODAY },
          { learnerToken: 'tkn_004', occurredAt: TODAY }, // rejected
          { learnerToken: 'tkn_005', occurredAt: TODAY }, // rejected
        ],
      }),
      TODAY,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.qualityScore).toBe(60);
      expect(result.blockedDownstream).toBe(false);
    }
  });

  it('score < 60 blocks downstream', () => {
    // 4 records; 3 rejected → score = 25
    const result = runQualityChecks(
      baseInput({
        sampleRecords: [
          { learnerToken: 'tkn_001', attendanceStatus: 'PRESENT', occurredAt: TODAY },
          { learnerToken: 'tkn_002', occurredAt: TODAY },
          { learnerToken: 'tkn_003', occurredAt: TODAY },
          { learnerToken: 'tkn_004', occurredAt: TODAY },
        ],
      }),
      TODAY,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.qualityScore).toBe(25);
      expect(result.blockedDownstream).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// IMPOSSIBLE_VALUE
// ---------------------------------------------------------------------------

describe('runQualityChecks — impossible values', () => {
  it('raises IMPOSSIBLE_VALUE ERROR for attendanceRatePct > 100', () => {
    const result = runQualityChecks(
      baseInput({
        sampleRecords: [
          {
            learnerToken: 'tkn_001',
            attendanceStatus: 'PRESENT',
            occurredAt: TODAY,
            attendanceRatePct: 110,
          },
        ],
      }),
      TODAY,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      const issue = result.issues.find(
        (i) => i.kind === 'IMPOSSIBLE_VALUE' && i.field === 'attendanceRatePct',
      );
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe('ERROR');
      // A single ERROR issue → record rejected → score = 0 → blocked
      expect(result.blockedDownstream).toBe(true);
    }
  });

  it('raises IMPOSSIBLE_VALUE ERROR for a negative absentDays', () => {
    const result = runQualityChecks(
      baseInput({
        sampleRecords: [
          {
            learnerToken: 'tkn_001',
            attendanceStatus: 'ABSENT',
            occurredAt: TODAY,
            absentDays: -3,
          },
        ],
      }),
      TODAY,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(
        result.issues.some(
          (i) => i.kind === 'IMPOSSIBLE_VALUE' && i.field === 'absentDays',
        ),
      ).toBe(true);
    }
  });

  it('raises IMPOSSIBLE_VALUE WARNING for a future occurredAt date', () => {
    const result = runQualityChecks(
      baseInput({
        sampleRecords: [
          {
            learnerToken: 'tkn_001',
            attendanceStatus: 'PRESENT',
            occurredAt: '2099-01-01',
          },
        ],
      }),
      TODAY,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      const issue = result.issues.find(
        (i) => i.kind === 'IMPOSSIBLE_VALUE' && i.field === 'occurredAt',
      );
      expect(issue).toBeDefined();
      // Future date is a WARNING — record is not rejected
      expect(issue?.severity).toBe('WARNING');
      expect(result.rejectedRecords).toBe(0);
      expect(result.qualityScore).toBe(100);
    }
  });

  it('raises IMPOSSIBLE_VALUE for scorePercent > 100 in ASSESSMENT domain', () => {
    const result = runQualityChecks(
      {
        tenantId: TENANT_ID,
        runId: RUN_ID,
        domain: 'ASSESSMENT',
        sampleRecords: [
          { learnerToken: 'tkn_001', scorePercent: 105, occurredAt: TODAY },
        ],
      },
      TODAY,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(
        result.issues.some(
          (i) => i.kind === 'IMPOSSIBLE_VALUE' && i.field === 'scorePercent',
        ),
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// DUPLICATE_RECORD
// ---------------------------------------------------------------------------

describe('runQualityChecks — duplicate records', () => {
  it('raises DUPLICATE_RECORD WARNING for an exact duplicate on key fields', () => {
    const result = runQualityChecks(
      baseInput({
        sampleRecords: [
          { learnerToken: 'tkn_001', attendanceStatus: 'PRESENT', occurredAt: TODAY },
          { learnerToken: 'tkn_001', attendanceStatus: 'PRESENT', occurredAt: TODAY },
        ],
      }),
      TODAY,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.issues.some((i) => i.kind === 'DUPLICATE_RECORD')).toBe(true);
      const dup = result.issues.find((i) => i.kind === 'DUPLICATE_RECORD');
      expect(dup?.severity).toBe('WARNING');
    }
  });

  it('does not flag as duplicate when learnerToken differs', () => {
    const result = runQualityChecks(
      baseInput({
        sampleRecords: [
          { learnerToken: 'tkn_001', attendanceStatus: 'PRESENT', occurredAt: TODAY },
          { learnerToken: 'tkn_002', attendanceStatus: 'PRESENT', occurredAt: TODAY },
        ],
      }),
      TODAY,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.issues.some((i) => i.kind === 'DUPLICATE_RECORD')).toBe(false);
    }
  });

  it('duplicate WARNING alone does not reject the record (score stays 100)', () => {
    // Duplicate without any ERROR issues → rejectedRecords = 0
    const result = runQualityChecks(
      baseInput({
        sampleRecords: [
          { learnerToken: 'tkn_001', attendanceStatus: 'PRESENT', occurredAt: TODAY },
          { learnerToken: 'tkn_001', attendanceStatus: 'PRESENT', occurredAt: TODAY },
        ],
      }),
      TODAY,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.rejectedRecords).toBe(0);
      expect(result.qualityScore).toBe(100);
    }
  });
});

// ---------------------------------------------------------------------------
// REFERENTIAL_INTEGRITY
// ---------------------------------------------------------------------------

describe('runQualityChecks — referential integrity', () => {
  it('raises REFERENTIAL_INTEGRITY ERROR for an invalid attendanceStatus value', () => {
    const result = runQualityChecks(
      baseInput({
        sampleRecords: [
          { learnerToken: 'tkn_001', attendanceStatus: 'MAYBE', occurredAt: TODAY },
        ],
      }),
      TODAY,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(
        result.issues.some(
          (i) => i.kind === 'REFERENTIAL_INTEGRITY' && i.field === 'attendanceStatus',
        ),
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Multi-domain
// ---------------------------------------------------------------------------

describe('runQualityChecks — multiple domains', () => {
  it('BEHAVIOUR domain: checks learnerToken and occurredAt as required', () => {
    const result = runQualityChecks(
      {
        tenantId: TENANT_ID,
        runId: RUN_ID,
        domain: 'BEHAVIOUR',
        sampleRecords: [
          { learnerToken: 'tkn_001', occurredAt: TODAY, incidentType: 'VERBAL' },
        ],
      },
      TODAY,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.qualityScore).toBe(100);
      expect(result.issues).toHaveLength(0);
    }
  });

  it('DEMOGRAPHIC domain: checks only learnerToken as required', () => {
    const result = runQualityChecks(
      {
        tenantId: TENANT_ID,
        runId: RUN_ID,
        domain: 'DEMOGRAPHIC',
        sampleRecords: [{ learnerToken: 'tkn_001', homeLanguage: 'AFRIKAANS' }],
      },
      TODAY,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.qualityScore).toBe(100);
    }
  });
});

// ---------------------------------------------------------------------------
// PII safety — issue details must not expose raw identifiers
// ---------------------------------------------------------------------------

describe('runQualityChecks — PII safety', () => {
  it('issue detail does not include the raw field value (only the field name)', () => {
    const sensitiveToken = 'uuid-looks-like-a-real-id-abc123';
    const result = runQualityChecks(
      baseInput({
        sampleRecords: [{ learnerToken: sensitiveToken, occurredAt: TODAY }],
      }),
      TODAY,
    );

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      for (const issue of result.issues) {
        expect(issue.detail).not.toContain(sensitiveToken);
      }
    }
  });
});
