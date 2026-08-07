// Stage 09 step 1 — warehouse domain type validation tests.
//
// All tests cover the Zod schema boundaries: valid inputs parse cleanly;
// invalid inputs are rejected with schema errors. No database or Docker required.

import { describe, expect, it } from 'vitest';

import {
  AttendanceSummary,
  ConformedEvent,
  ConnectorKindSchema,
  DW01Result,
  DW06Result,
  DW07Result,
  DW08Result,
  DataDomainSchema,
  IngestRunStatusSchema,
  IngestSourceStatusSchema,
  Insight,
  InsightScope,
  Learner360Profile,
  NextStep,
  QualityIssue,
  QualityReport,
  RawRecord,
  ScreeningFeatureRecord,
} from '../src/types.js';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const LEARNER_ID = '00000000-0000-0000-0000-000000000002';
const SCOPE_ID = '00000000-0000-0000-0000-000000000003';
const NOW = '2026-08-07T08:00:00.000Z';

describe('ConnectorKindSchema', () => {
  it('accepts all seven connector kinds', () => {
    for (const kind of [
      'FILE_CSV',
      'FILE_XLSX',
      'SIS_API',
      'SCREENER_API',
      'ATTENDANCE_API',
      'BEHAVIOUR_API',
      'MANUAL_UPLOAD',
    ]) {
      expect(ConnectorKindSchema.safeParse(kind).success).toBe(true);
    }
  });

  it('rejects an unrecognised kind', () => {
    expect(ConnectorKindSchema.safeParse('FTP').success).toBe(false);
  });
});

describe('IngestSourceStatusSchema', () => {
  it('accepts ACTIVE, PAUSED and ERROR', () => {
    for (const s of ['ACTIVE', 'PAUSED', 'ERROR']) {
      expect(IngestSourceStatusSchema.safeParse(s).success).toBe(true);
    }
  });
});

describe('IngestRunStatusSchema', () => {
  it('accepts all five run statuses', () => {
    for (const s of [
      'RUNNING',
      'SUCCEEDED',
      'FAILED',
      'PARTIALLY_SUCCEEDED',
      'QUARANTINED',
    ]) {
      expect(IngestRunStatusSchema.safeParse(s).success).toBe(true);
    }
  });
});

describe('DataDomainSchema', () => {
  it('accepts all six domains', () => {
    for (const d of [
      'ATTENDANCE',
      'ASSESSMENT',
      'BEHAVIOUR',
      'WELLBEING',
      'DEMOGRAPHIC',
      'SCREENER',
    ]) {
      expect(DataDomainSchema.safeParse(d).success).toBe(true);
    }
  });

  it('rejects an unrecognised domain', () => {
    expect(DataDomainSchema.safeParse('TIMETABLE').success).toBe(false);
  });
});

describe('RawRecord', () => {
  it('accepts a minimal raw record', () => {
    expect(
      RawRecord.safeParse({
        sourceRef: 'row 1 of attendance_2026_t1.csv',
        payload: { learnerNo: 'LNR001', date: '2026-08-01', status: 'P' },
      }).success,
    ).toBe(true);
  });

  it('accepts an optional schemaVersion', () => {
    expect(
      RawRecord.safeParse({
        sourceRef: 'row 1',
        payload: {},
        schemaVersion: 'v2',
      }).success,
    ).toBe(true);
  });

  it('rejects an empty sourceRef', () => {
    expect(RawRecord.safeParse({ sourceRef: '', payload: {} }).success).toBe(false);
  });
});

describe('ConformedEvent', () => {
  const base = {
    learnerId: LEARNER_ID,
    domain: 'ATTENDANCE',
    eventType: 'attendance.present',
    occurredAt: NOW,
    payload: { attendanceCode: 'P' },
  };

  it('accepts a valid conformed event', () => {
    expect(ConformedEvent.safeParse(base).success).toBe(true);
  });

  it('accepts optional rawRecordId and sourceId', () => {
    expect(
      ConformedEvent.safeParse({
        ...base,
        rawRecordId: '00000000-0000-0000-0000-000000000010',
        sourceId: '00000000-0000-0000-0000-000000000011',
      }).success,
    ).toBe(true);
  });

  it('rejects a non-UUID learnerId', () => {
    expect(ConformedEvent.safeParse({ ...base, learnerId: 'not-a-uuid' }).success).toBe(
      false,
    );
  });

  it('rejects an invalid domain', () => {
    expect(ConformedEvent.safeParse({ ...base, domain: 'LUNCH' }).success).toBe(false);
  });
});

describe('QualityIssue', () => {
  it('accepts a valid quality issue', () => {
    expect(
      QualityIssue.safeParse({
        kind: 'MISSING_FIELD',
        field: 'date',
        detail: 'date column is empty in 12 rows',
        severity: 'ERROR',
      }).success,
    ).toBe(true);
  });

  it('rejects an empty detail', () => {
    expect(
      QualityIssue.safeParse({
        kind: 'DUPLICATE_RECORD',
        detail: '',
        severity: 'WARNING',
      }).success,
    ).toBe(false);
  });
});

describe('QualityReport', () => {
  it('accepts a clean report (zero issues)', () => {
    expect(
      QualityReport.safeParse({
        qualityScore: 100,
        issues: [],
        blockedDownstream: false,
        totalRecords: 1000,
        rejectedRecords: 0,
      }).success,
    ).toBe(true);
  });

  it('accepts a blocked report with issues', () => {
    expect(
      QualityReport.safeParse({
        qualityScore: 40,
        issues: [
          { kind: 'MISSING_FIELD', detail: 'critical field absent', severity: 'ERROR' },
        ],
        blockedDownstream: true,
        totalRecords: 100,
        rejectedRecords: 60,
      }).success,
    ).toBe(true);
  });

  it('rejects a score above 100', () => {
    expect(
      QualityReport.safeParse({
        qualityScore: 101,
        issues: [],
        blockedDownstream: false,
        totalRecords: 0,
        rejectedRecords: 0,
      }).success,
    ).toBe(false);
  });
});

describe('AttendanceSummary', () => {
  it('accepts a valid summary', () => {
    expect(
      AttendanceSummary.safeParse({
        termNumber: 1,
        academicYear: 2026,
        presentDays: 45,
        absentDays: 3,
        lateDays: 2,
        attendanceRatePct: 93.75,
      }).success,
    ).toBe(true);
  });

  it('rejects termNumber outside 1-4', () => {
    expect(
      AttendanceSummary.safeParse({
        termNumber: 5,
        academicYear: 2026,
        presentDays: 0,
        absentDays: 0,
        lateDays: 0,
        attendanceRatePct: 0,
      }).success,
    ).toBe(false);
  });
});

describe('Learner360Profile', () => {
  const base: Learner360Profile = {
    learnerId: LEARNER_ID,
    tenantId: TENANT_ID,
    attendance: null,
    academic: null,
    behaviour: null,
    wellbeing: null,
    screenerResults: null,
    dataQualityNote: null,
    lastMaterialisedAt: NOW,
  };

  it('accepts a minimal profile with all nulls', () => {
    expect(Learner360Profile.safeParse(base).success).toBe(true);
  });

  it('accepts a profile with an attendance summary', () => {
    expect(
      Learner360Profile.safeParse({
        ...base,
        attendance: {
          termNumber: 1,
          academicYear: 2026,
          presentDays: 40,
          absentDays: 5,
          lateDays: 0,
          attendanceRatePct: 88.9,
        },
      }).success,
    ).toBe(true);
  });

  it('rejects a non-UUID learnerId', () => {
    expect(Learner360Profile.safeParse({ ...base, learnerId: 'bad' }).success).toBe(
      false,
    );
  });
});

describe('ScreeningFeatureRecord', () => {
  it('accepts a valid feature record', () => {
    expect(
      ScreeningFeatureRecord.safeParse({
        learnerId: LEARNER_ID,
        featureName: 'literacy_score',
        featureValue: 72.5,
        asAt: NOW,
      }).success,
    ).toBe(true);
  });

  it('rejects an empty featureName', () => {
    expect(
      ScreeningFeatureRecord.safeParse({
        learnerId: LEARNER_ID,
        featureName: '',
        featureValue: 72.5,
        asAt: NOW,
      }).success,
    ).toBe(false);
  });
});

describe('DW01Result', () => {
  it('accepts an ok result', () => {
    expect(
      DW01Result.safeParse({
        status: 'ok',
        runId: SCOPE_ID,
        recordsReceived: 1000,
        recordsConformed: 995,
        recordsRejected: 5,
      }).success,
    ).toBe(true);
  });

  it('accepts a needs_input result', () => {
    expect(
      DW01Result.safeParse({ status: 'needs_input', detail: 'No source configured' })
        .success,
    ).toBe(true);
  });
});

describe('DW06Result', () => {
  it('accepts a needs_input result when no data available', () => {
    expect(
      DW06Result.safeParse({
        status: 'needs_input',
        learnerId: LEARNER_ID,
        detail: 'No domain events found for learner in term 1 / 2026',
      }).success,
    ).toBe(true);
  });
});

describe('InsightScope', () => {
  it('accepts all four scopes', () => {
    for (const s of ['LEARNER', 'CLASS', 'GRADE', 'SCHOOL']) {
      expect(InsightScope.safeParse(s).success).toBe(true);
    }
  });
});

describe('Insight', () => {
  it('accepts a valid insight', () => {
    expect(
      Insight.safeParse({
        scope: 'LEARNER',
        scopeId: LEARNER_ID,
        domain: 'ATTENDANCE',
        narrative: 'Attendance has declined in the last four weeks.',
        confidenceScore: 0.85,
        dataPointCount: 20,
        sourceEventIds: [SCOPE_ID],
        generatedAt: NOW,
      }).success,
    ).toBe(true);
  });

  it('rejects an empty sourceEventIds array', () => {
    expect(
      Insight.safeParse({
        scope: 'LEARNER',
        scopeId: LEARNER_ID,
        domain: 'ATTENDANCE',
        narrative: 'Test',
        confidenceScore: 0.5,
        dataPointCount: 1,
        sourceEventIds: [],
        generatedAt: NOW,
      }).success,
    ).toBe(false);
  });
});

describe('DW07Result', () => {
  it('accepts a needs_input result (no data ingested yet)', () => {
    expect(
      DW07Result.safeParse({
        status: 'needs_input',
        scope: 'LEARNER',
        scopeId: LEARNER_ID,
        detail: 'No domain events found for this learner.',
      }).success,
    ).toBe(true);
  });
});

describe('NextStep', () => {
  it('accepts a valid next step', () => {
    expect(
      NextStep.safeParse({
        description: 'Contact guardian about attendance trend.',
        owner: 'Class teacher',
        dueDate: '2026-08-14T00:00:00.000Z',
        insightId: SCOPE_ID,
        rationale: 'Attendance below 80% for three consecutive weeks.',
      }).success,
    ).toBe(true);
  });
});

describe('DW08Result', () => {
  it('accepts a needs_input result (no insight to base next step on)', () => {
    expect(
      DW08Result.safeParse({ status: 'needs_input', detail: 'No insight found.' })
        .success,
    ).toBe(true);
  });
});
