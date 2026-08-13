import { describe, expect, it } from 'vitest';

import {
  checkAttendance,
  checkConduct,
  checkFees,
  checkPdPoints,
  checkSias,
  checkWse,
  runComplianceChecks,
} from '../src/index.js';

// ---------------------------------------------------------------------------
// Attendance checks
// ---------------------------------------------------------------------------
describe('checkAttendance', () => {
  it('returns no findings for a Grade R learner with good attendance in 2025', () => {
    const result = checkAttendance({
      tenantId: 'tenant-1',
      academicYear: 2025,
      learners: [{ learnerId: 'lr-001', grade: 'R', attendanceRatePct: 95 }],
    });
    expect(result).toHaveLength(0);
  });

  it('returns VIOLATION for a Grade R learner with 0% attendance in 2025 (BELA)', () => {
    const result = checkAttendance({
      tenantId: 'tenant-1',
      academicYear: 2025,
      learners: [{ learnerId: 'lr-002', grade: 'R', attendanceRatePct: 0 }],
    });
    const violation = result.find((f) => f.code === 'GRADE_R_ATTENDANCE_NOT_TRACKED');
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe('VIOLATION');
    expect(violation?.area).toBe('ATTENDANCE');
    expect(violation?.basis.documentId).toBe('bela-act-32-of-2024');
  });

  it('does NOT flag Grade R 0% attendance before BELA effective year (2024)', () => {
    const result = checkAttendance({
      tenantId: 'tenant-1',
      academicYear: 2024,
      learners: [{ learnerId: 'lr-003', grade: 'R', attendanceRatePct: 0 }],
    });
    expect(
      result.find((f) => f.code === 'GRADE_R_ATTENDANCE_NOT_TRACKED'),
    ).toBeUndefined();
  });

  it('returns WARNING for any learner with attendance below 80%', () => {
    const result = checkAttendance({
      tenantId: 'tenant-1',
      academicYear: 2025,
      learners: [{ learnerId: 'lr-004', grade: '3', attendanceRatePct: 70 }],
    });
    const warning = result.find((f) => f.code === 'LOW_ATTENDANCE_RATE');
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe('WARNING');
    expect(warning?.basis.documentId).toBe('sasa-84-of-1996');
  });

  it('returns both VIOLATION and WARNING for a Grade R learner with 0% in 2025', () => {
    const result = checkAttendance({
      tenantId: 'tenant-1',
      academicYear: 2025,
      learners: [{ learnerId: 'lr-005', grade: 'R', attendanceRatePct: 0 }],
    });
    expect(result.some((f) => f.code === 'GRADE_R_ATTENDANCE_NOT_TRACKED')).toBe(true);
    expect(result.some((f) => f.code === 'LOW_ATTENDANCE_RATE')).toBe(true);
  });

  it('returns no findings for an empty learners array', () => {
    const result = checkAttendance({
      tenantId: 'tenant-1',
      academicYear: 2025,
      learners: [],
    });
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// School fees checks
// ---------------------------------------------------------------------------
describe('checkFees', () => {
  it('returns no findings for a Quintile 4 school that charges fees with exemption procedure', () => {
    const result = checkFees({
      tenantId: 'tenant-1',
      quintile: 4,
      schoolFeeCharged: true,
      feeExemptionProcedureInPlace: true,
    });
    expect(result).toHaveLength(0);
  });

  it('returns VIOLATION for a Quintile 2 school charging fees', () => {
    const result = checkFees({
      tenantId: 'tenant-1',
      quintile: 2,
      schoolFeeCharged: true,
      feeExemptionProcedureInPlace: false,
    });
    const violation = result.find((f) => f.code === 'NO_FEE_SCHOOL_CHARGING_FEES');
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe('VIOLATION');
    expect(violation?.basis.documentId).toBe('doe-free-quality-education-2003');
  });

  it('returns VIOLATION for a Quintile 5 school with no exemption procedure', () => {
    const result = checkFees({
      tenantId: 'tenant-1',
      quintile: 5,
      schoolFeeCharged: true,
      feeExemptionProcedureInPlace: false,
    });
    const violation = result.find((f) => f.code === 'NO_FEE_EXEMPTION_PROCEDURE');
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe('VIOLATION');
    expect(violation?.basis.documentId).toBe('sasa-84-of-1996');
  });

  it('returns INFO for a no-fee school missing an exemption procedure', () => {
    const result = checkFees({
      tenantId: 'tenant-1',
      quintile: 1,
      schoolFeeCharged: false,
      feeExemptionProcedureInPlace: false,
    });
    const info = result.find(
      (f) => f.code === 'NO_FEE_SCHOOL_MISSING_EXEMPTION_PROCEDURE',
    );
    expect(info).toBeDefined();
    expect(info?.severity).toBe('INFO');
  });

  it('returns no findings for a Quintile 3 school not charging fees with procedure', () => {
    const result = checkFees({
      tenantId: 'tenant-1',
      quintile: 3,
      schoolFeeCharged: false,
      feeExemptionProcedureInPlace: true,
    });
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Conduct checks
// ---------------------------------------------------------------------------
describe('checkConduct', () => {
  it('returns no findings for a school with clean records', () => {
    const result = checkConduct({
      tenantId: 'tenant-1',
      corporalPunishmentRecordedAsPermitted: false,
      disciplinaryRecords: [],
    });
    expect(result).toHaveLength(0);
  });

  it('returns VIOLATION when corporal punishment is recorded as permitted', () => {
    const result = checkConduct({
      tenantId: 'tenant-1',
      corporalPunishmentRecordedAsPermitted: true,
      disciplinaryRecords: [],
    });
    const violation = result.find(
      (f) => f.code === 'CORPORAL_PUNISHMENT_RECORDED_AS_PERMITTED',
    );
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe('VIOLATION');
    expect(violation?.basis.documentId).toBe('sasa-84-of-1996');
  });

  it('returns VIOLATION for a disciplinary record with no charge sheet', () => {
    const result = checkConduct({
      tenantId: 'tenant-1',
      corporalPunishmentRecordedAsPermitted: false,
      disciplinaryRecords: [
        {
          educatorToken: 'edu-tok-001',
          hasChargeSheet: false,
          hasResponseOpportunity: true,
        },
      ],
    });
    const violation = result.find((f) => f.code === 'MISSING_CHARGE_SHEET');
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe('VIOLATION');
    expect(violation?.basis.documentId).toBe('eea-76-of-1998');
    expect(violation?.context).toBe('edu-tok-001');
  });

  it('returns VIOLATION for a disciplinary record with no response opportunity', () => {
    const result = checkConduct({
      tenantId: 'tenant-1',
      corporalPunishmentRecordedAsPermitted: false,
      disciplinaryRecords: [
        {
          educatorToken: 'edu-tok-002',
          hasChargeSheet: true,
          hasResponseOpportunity: false,
        },
      ],
    });
    const violation = result.find((f) => f.code === 'NO_RESPONSE_OPPORTUNITY');
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe('VIOLATION');
  });

  it('returns two violations per non-compliant disciplinary record', () => {
    const result = checkConduct({
      tenantId: 'tenant-1',
      corporalPunishmentRecordedAsPermitted: false,
      disciplinaryRecords: [
        {
          educatorToken: 'edu-tok-003',
          hasChargeSheet: false,
          hasResponseOpportunity: false,
        },
      ],
    });
    expect(result.filter((f) => f.area === 'CONDUCT')).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// SIAS process checks
// ---------------------------------------------------------------------------
describe('checkSias', () => {
  it('returns no findings for a resolved referral with all stages and documentation', () => {
    const result = checkSias({
      tenantId: 'tenant-1',
      referrals: [
        {
          referralId: 'ref-001',
          stageCompleted: 6,
          documentationComplete: true,
          active: false,
        },
      ],
    });
    expect(result).toHaveLength(0);
  });

  it('returns WARNING for an active referral that has not started the SIAS process', () => {
    const result = checkSias({
      tenantId: 'tenant-1',
      referrals: [
        {
          referralId: 'ref-002',
          stageCompleted: 0,
          documentationComplete: false,
          active: true,
        },
      ],
    });
    const warning = result.find((f) => f.code === 'SIAS_NOT_STARTED');
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe('WARNING');
    expect(warning?.basis.documentId).toBe('dbe-sias-2014');
  });

  it('returns VIOLATION for a referral with incomplete documentation', () => {
    const result = checkSias({
      tenantId: 'tenant-1',
      referrals: [
        {
          referralId: 'ref-003',
          stageCompleted: 3,
          documentationComplete: false,
          active: true,
        },
      ],
    });
    const violation = result.find((f) => f.code === 'SIAS_DOCUMENTATION_INCOMPLETE');
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe('VIOLATION');
    expect(violation?.context).toBe('ref-003');
  });

  it('returns INFO for a referral that has completed all stages but is still active', () => {
    const result = checkSias({
      tenantId: 'tenant-1',
      referrals: [
        {
          referralId: 'ref-004',
          stageCompleted: 6,
          documentationComplete: true,
          active: true,
        },
      ],
    });
    const info = result.find((f) => f.code === 'SIAS_PROCESS_COMPLETE_BUT_ACTIVE');
    expect(info).toBeDefined();
    expect(info?.severity).toBe('INFO');
  });

  it('returns no findings for an empty referrals array', () => {
    const result = checkSias({ tenantId: 'tenant-1', referrals: [] });
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// PD points checks
// ---------------------------------------------------------------------------
describe('checkPdPoints', () => {
  it('returns no findings for an educator on track in year 1', () => {
    const result = checkPdPoints({
      tenantId: 'tenant-1',
      educators: [{ educatorToken: 'edu-tok-A', pdPointsAccumulated: 0, cycleYear: 1 }],
    });
    expect(result).toHaveLength(0);
  });

  it('returns VIOLATION for an educator with a points shortfall at end of cycle (year 3)', () => {
    const result = checkPdPoints({
      tenantId: 'tenant-1',
      educators: [{ educatorToken: 'edu-tok-B', pdPointsAccumulated: 100, cycleYear: 3 }],
    });
    const violation = result.find((f) => f.code === 'PD_POINTS_SHORTFALL_END_OF_CYCLE');
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe('VIOLATION');
    expect(violation?.basis.documentId).toBe('sace-pd-points-schedule');
    expect(violation?.context).toBe('edu-tok-B');
  });

  it('returns no findings for an educator with exactly 150 points at year 3', () => {
    const result = checkPdPoints({
      tenantId: 'tenant-1',
      educators: [{ educatorToken: 'edu-tok-C', pdPointsAccumulated: 150, cycleYear: 3 }],
    });
    expect(result).toHaveLength(0);
  });

  it('returns INFO advisory for an educator below midpoint in year 2', () => {
    const result = checkPdPoints({
      tenantId: 'tenant-1',
      educators: [{ educatorToken: 'edu-tok-D', pdPointsAccumulated: 20, cycleYear: 2 }],
    });
    const info = result.find((f) => f.code === 'PD_POINTS_BELOW_MIDPOINT_ADVISORY');
    expect(info).toBeDefined();
    expect(info?.severity).toBe('INFO');
  });

  it('returns no findings for an empty educators array', () => {
    const result = checkPdPoints({ tenantId: 'tenant-1', educators: [] });
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// WSE ratings checks
// ---------------------------------------------------------------------------
describe('checkWse', () => {
  const fullValidRecords = [
    { area: 'School management and leadership', rating: 3 },
    { area: 'Governance and relationships with parents and community', rating: 2 },
    { area: 'Teaching and learning', rating: 4 },
    { area: 'Curriculum provision', rating: 3 },
    { area: 'Human resource management and development', rating: 2 },
    { area: 'Physical environment', rating: 1 },
    { area: 'Parents and community', rating: 3 },
  ];

  it('returns no findings for a complete and valid WSE report', () => {
    const result = checkWse({
      tenantId: 'tenant-1',
      evaluationRecords: fullValidRecords,
    });
    expect(result).toHaveLength(0);
  });

  it('returns VIOLATION when a required WSE area is missing', () => {
    const records = fullValidRecords.filter((r) => r.area !== 'Teaching and learning');
    const result = checkWse({ tenantId: 'tenant-1', evaluationRecords: records });
    const violation = result.find((f) => f.code === 'WSE_AREA_MISSING');
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe('VIOLATION');
    expect(violation?.context).toBe('Teaching and learning');
    expect(violation?.basis.documentId).toBe('doe-wse-policy-2001');
  });

  it('returns VIOLATION for a rating of 0 (below the valid range)', () => {
    const records = [...fullValidRecords];
    records[0] = { area: 'School management and leadership', rating: 0 };
    const result = checkWse({ tenantId: 'tenant-1', evaluationRecords: records });
    const violation = result.find((f) => f.code === 'WSE_INVALID_RATING');
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe('VIOLATION');
  });

  it('returns VIOLATION for a rating of 5 (above the valid range)', () => {
    const records = [...fullValidRecords];
    records[0] = { area: 'School management and leadership', rating: 5 };
    const result = checkWse({ tenantId: 'tenant-1', evaluationRecords: records });
    expect(result.find((f) => f.code === 'WSE_INVALID_RATING')).toBeDefined();
  });

  it('returns no findings for an empty evaluationRecords array (no WSE conducted)', () => {
    // All 7 areas missing → 7 VIOLATION findings, one per missing area
    const result = checkWse({ tenantId: 'tenant-1', evaluationRecords: [] });
    expect(result.filter((f) => f.code === 'WSE_AREA_MISSING')).toHaveLength(7);
  });
});

// ---------------------------------------------------------------------------
// Compliance engine (aggregator)
// ---------------------------------------------------------------------------
describe('runComplianceChecks', () => {
  it('returns an empty report when all checks are clean', () => {
    const report = runComplianceChecks(
      {
        tenantId: 'tenant-clean',
        attendance: {
          tenantId: 'tenant-clean',
          academicYear: 2025,
          learners: [{ learnerId: 'lr-A', grade: 'R', attendanceRatePct: 90 }],
        },
        fees: {
          tenantId: 'tenant-clean',
          quintile: 4,
          schoolFeeCharged: true,
          feeExemptionProcedureInPlace: true,
        },
      },
      '2026-08-13T10:00:00.000Z',
    );
    expect(report.findings).toHaveLength(0);
    expect(report.summary.violations).toBe(0);
    expect(report.summary.warnings).toBe(0);
    expect(report.summary.infos).toBe(0);
    expect(report.tenantId).toBe('tenant-clean');
    expect(report.generatedAt).toBe('2026-08-13T10:00:00.000Z');
  });

  it('aggregates findings from multiple check areas', () => {
    const report = runComplianceChecks(
      {
        tenantId: 'tenant-multi',
        fees: {
          tenantId: 'tenant-multi',
          quintile: 1,
          schoolFeeCharged: true, // VIOLATION
          feeExemptionProcedureInPlace: false,
        },
        conduct: {
          tenantId: 'tenant-multi',
          corporalPunishmentRecordedAsPermitted: true, // VIOLATION
          disciplinaryRecords: [],
        },
      },
      '2026-08-13T10:00:00.000Z',
    );
    expect(report.summary.violations).toBeGreaterThanOrEqual(2);
  });

  it('runs only the checks for which input is provided', () => {
    const report = runComplianceChecks(
      { tenantId: 'tenant-partial' },
      '2026-08-13T10:00:00.000Z',
    );
    expect(report.findings).toHaveLength(0);
  });

  it('counts violations, warnings, and infos correctly in summary', () => {
    const report = runComplianceChecks(
      {
        tenantId: 'tenant-summary',
        attendance: {
          tenantId: 'tenant-summary',
          academicYear: 2025,
          learners: [
            { learnerId: 'lr-01', grade: 'R', attendanceRatePct: 0 }, // VIOLATION + WARNING
            { learnerId: 'lr-02', grade: '1', attendanceRatePct: 70 }, // WARNING only
          ],
        },
        pdPoints: {
          tenantId: 'tenant-summary',
          educators: [
            { educatorToken: 'edu-001', pdPointsAccumulated: 20, cycleYear: 2 }, // INFO
          ],
        },
      },
      '2026-08-13T10:00:00.000Z',
    );
    expect(report.summary.violations).toBe(1);
    expect(report.summary.warnings).toBe(2);
    expect(report.summary.infos).toBe(1);
  });
});
