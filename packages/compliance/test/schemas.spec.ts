// The input-schema boundary — Stage 8 (repository audit follow-through, Task 15).
//
// Every check function in this package (checkAttendance, checkFees, ...) takes an
// already-typed input and does no runtime validation of its own — engine.ts's own header
// and index.ts's own comment both say why: "pure synchronous functions... no invented
// rules." The Zod schemas in types.ts are what a real caller is expected to validate
// untrusted data against before ever reaching a check function. compliance.spec.ts
// thoroughly covers the business-logic findings each check produces from valid input, but
// nothing anywhere proved the schemas themselves actually reject invalid data — the
// package's real input-validation boundary had no test at all. This file is that
// boundary's own test, per CLAUDE.md's Definition of Done ("at least two failure paths").

import { describe, expect, it } from 'vitest';

import {
  AttendanceInput,
  ComplianceInput,
  ConductInput,
  FeesInput,
  PdPointsInput,
  SiasInput,
  WseInput,
} from '../src/index.js';

describe('AttendanceInput', () => {
  it('accepts a well-formed input', () => {
    const result = AttendanceInput.safeParse({
      tenantId: 'tenant-1',
      academicYear: 2025,
      learners: [{ learnerId: 'lr-001', grade: 'R', attendanceRatePct: 95 }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects attendanceRatePct above 100', () => {
    const result = AttendanceInput.safeParse({
      tenantId: 'tenant-1',
      academicYear: 2025,
      learners: [{ learnerId: 'lr-001', grade: 'R', attendanceRatePct: 101 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a negative attendanceRatePct', () => {
    const result = AttendanceInput.safeParse({
      tenantId: 'tenant-1',
      academicYear: 2025,
      learners: [{ learnerId: 'lr-001', grade: 'R', attendanceRatePct: -1 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an academicYear before 2020', () => {
    const result = AttendanceInput.safeParse({
      tenantId: 'tenant-1',
      academicYear: 2019,
      learners: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty tenantId', () => {
    const result = AttendanceInput.safeParse({
      tenantId: '',
      academicYear: 2025,
      learners: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty learnerId', () => {
    const result = AttendanceInput.safeParse({
      tenantId: 'tenant-1',
      academicYear: 2025,
      learners: [{ learnerId: '', grade: 'R', attendanceRatePct: 90 }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts the boundary values 0 and 100 for attendanceRatePct', () => {
    const result = AttendanceInput.safeParse({
      tenantId: 'tenant-1',
      academicYear: 2025,
      learners: [
        { learnerId: 'lr-001', grade: '3', attendanceRatePct: 0 },
        { learnerId: 'lr-002', grade: '3', attendanceRatePct: 100 },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('FeesInput', () => {
  it('rejects a quintile of 0 (below the valid 1-5 range)', () => {
    const result = FeesInput.safeParse({
      tenantId: 'tenant-1',
      quintile: 0,
      schoolFeeCharged: true,
      feeExemptionProcedureInPlace: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a quintile of 6 (above the valid 1-5 range)', () => {
    const result = FeesInput.safeParse({
      tenantId: 'tenant-1',
      quintile: 6,
      schoolFeeCharged: true,
      feeExemptionProcedureInPlace: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer quintile', () => {
    const result = FeesInput.safeParse({
      tenantId: 'tenant-1',
      quintile: 2.5,
      schoolFeeCharged: true,
      feeExemptionProcedureInPlace: true,
    });
    expect(result.success).toBe(false);
  });
});

describe('ConductInput', () => {
  it('rejects an empty educatorToken', () => {
    const result = ConductInput.safeParse({
      tenantId: 'tenant-1',
      corporalPunishmentRecordedAsPermitted: false,
      disciplinaryRecords: [
        { educatorToken: '', hasChargeSheet: true, hasResponseOpportunity: true },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe('SiasInput', () => {
  it('rejects a stageCompleted above 6', () => {
    const result = SiasInput.safeParse({
      tenantId: 'tenant-1',
      referrals: [
        {
          referralId: 'ref-1',
          stageCompleted: 7,
          documentationComplete: true,
          active: false,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a negative stageCompleted', () => {
    const result = SiasInput.safeParse({
      tenantId: 'tenant-1',
      referrals: [
        {
          referralId: 'ref-1',
          stageCompleted: -1,
          documentationComplete: true,
          active: false,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty referralId', () => {
    const result = SiasInput.safeParse({
      tenantId: 'tenant-1',
      referrals: [
        { referralId: '', stageCompleted: 1, documentationComplete: true, active: false },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe('PdPointsInput', () => {
  it('rejects a cycleYear outside {1, 2, 3}', () => {
    const result = PdPointsInput.safeParse({
      tenantId: 'tenant-1',
      educators: [{ educatorToken: 'edu-1', pdPointsAccumulated: 0, cycleYear: 4 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a negative pdPointsAccumulated', () => {
    const result = PdPointsInput.safeParse({
      tenantId: 'tenant-1',
      educators: [{ educatorToken: 'edu-1', pdPointsAccumulated: -5, cycleYear: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty educatorToken', () => {
    const result = PdPointsInput.safeParse({
      tenantId: 'tenant-1',
      educators: [{ educatorToken: '', pdPointsAccumulated: 0, cycleYear: 1 }],
    });
    expect(result.success).toBe(false);
  });
});

describe('WseInput', () => {
  // Deliberate design choice, not an oversight — see checks/wse.ts: an out-of-range
  // rating (WSE_INVALID_RATING) is a business-logic finding, not a schema rejection, so
  // a school that submits a bad rating gets a compliance finding to act on rather than a
  // silent parse failure. This test exists so a future edit that "fixes" the schema to
  // add a range constraint gets caught here, not discovered by the business-logic tests
  // in compliance.spec.ts quietly losing coverage of that path.
  it('accepts an out-of-range rating at the schema level (range is enforced by checkWse, not here)', () => {
    const result = WseInput.safeParse({
      tenantId: 'tenant-1',
      evaluationRecords: [{ area: 'Teaching and learning', rating: 999 }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty area name', () => {
    const result = WseInput.safeParse({
      tenantId: 'tenant-1',
      evaluationRecords: [{ area: '', rating: 3 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer rating', () => {
    const result = WseInput.safeParse({
      tenantId: 'tenant-1',
      evaluationRecords: [{ area: 'Teaching and learning', rating: 2.5 }],
    });
    expect(result.success).toBe(false);
  });
});

describe('ComplianceInput', () => {
  it('accepts a tenantId-only input with every check area omitted', () => {
    const result = ComplianceInput.safeParse({ tenantId: 'tenant-1' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty tenantId', () => {
    const result = ComplianceInput.safeParse({ tenantId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a nested attendance block that fails its own validation', () => {
    const result = ComplianceInput.safeParse({
      tenantId: 'tenant-1',
      attendance: {
        tenantId: 'tenant-1',
        academicYear: 2025,
        learners: [{ learnerId: 'lr-1', grade: 'R', attendanceRatePct: 150 }],
      },
    });
    expect(result.success).toBe(false);
  });
});
