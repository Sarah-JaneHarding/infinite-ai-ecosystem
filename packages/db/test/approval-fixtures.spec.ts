import { describe, it, expect } from 'vitest';

import {
  APPROVAL_FIXTURES,
  LARGE_PRIMARY,
  SMALL_PRIMARY,
} from '../prisma/approval-fixtures.js';

// Same pattern `withTenant` enforces: a fixture id that fails it would be refused at runtime.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('dev approval fixtures', () => {
  it('uses ids the tenant-scoped client accepts, all distinct', () => {
    const all = APPROVAL_FIXTURES.flatMap((f) => [
      f.runId,
      f.taskId,
      f.traceId,
      f.tenantId,
    ]);
    for (const value of all) expect(value).toMatch(UUID);
    const own = APPROVAL_FIXTURES.flatMap((f) => [f.runId, f.taskId, f.traceId]);
    expect(new Set(own).size).toBe(own.length);
    expect(new Set(APPROVAL_FIXTURES.map((f) => f.stepId)).size).toBe(
      APPROVAL_FIXTURES.length,
    );
  });

  it('opens gates only in the two dev tenants seed.ts creates', () => {
    for (const f of APPROVAL_FIXTURES) {
      expect([SMALL_PRIMARY, LARGE_PRIMARY]).toContain(f.tenantId);
    }
  });

  it('has more HoD gates than the console shows, so its "more" line is exercised', () => {
    const hod = APPROVAL_FIXTURES.filter(
      (f) => f.tenantId === SMALL_PRIMARY && f.requiredRole === 'hod',
    );
    expect(hod.length).toBeGreaterThan(5);
  });

  it('has gates for the other roles, and one in another tenant to make a leak visible', () => {
    const small = APPROVAL_FIXTURES.filter((f) => f.tenantId === SMALL_PRIMARY);
    expect(small.some((f) => f.requiredRole === 'smt')).toBe(true);
    expect(small.some((f) => f.requiredRole === 'teacher')).toBe(true);
    expect(
      APPROVAL_FIXTURES.some(
        (f) => f.tenantId === LARGE_PRIMARY && f.requiredRole === 'hod',
      ),
    ).toBe(true);
  });

  it('is plainly marked as a fixture and carries no curriculum or personal information', () => {
    for (const f of APPROVAL_FIXTURES) {
      const text = JSON.stringify([f.artefact, f.evidence, f.diffAgainstPrevious]);
      expect(f.artefact.devFixture).toBe(true);
      expect(text).toContain('Dev fixture');
      expect(text).not.toMatch(
        /\b(Mr|Ms|Mrs|Dr)\b|@|grade|\bGr\b|mathematics|physics|learner|\d{6,}/i,
      );
    }
  });
});
