import { describe, it, expect } from 'vitest';
import {
  runReadinessChecks,
  allReadinessChecksPassed,
  type TenantReadinessInput,
} from '../src/readiness';

const PASSING_INPUT: TenantReadinessInput = {
  staffCount: 10,
  learnerCount: 100,
  hasConstitutionRatified: true,
  hasAtLeastOnePhase: true,
  hasAtLeastOneGrade: true,
  hasAtLeastOneSubject: true,
  hasSourceConnected: true,
  subscriptionActive: true,
};

describe('runReadinessChecks', () => {
  it('returns 5 checks for a fully configured tenant', () => {
    const results = runReadinessChecks(PASSING_INPUT);
    expect(results).toHaveLength(5);
  });

  it('all checks pass for a fully configured tenant', () => {
    const results = runReadinessChecks(PASSING_INPUT);
    for (const r of results) {
      expect(r.passed).toBe(true);
    }
  });

  it('staff_imported fails when staffCount is 0', () => {
    const results = runReadinessChecks({ ...PASSING_INPUT, staffCount: 0 });
    const check = results.find((r) => r.name === 'staff_imported');
    expect(check?.passed).toBe(false);
    expect(check?.message).toMatch(/staff member/i);
  });

  it('learners_imported fails when learnerCount is 0', () => {
    const results = runReadinessChecks({ ...PASSING_INPUT, learnerCount: 0 });
    const check = results.find((r) => r.name === 'learners_imported');
    expect(check?.passed).toBe(false);
  });

  it('constitution_ratified fails when hasConstitutionRatified is false', () => {
    const results = runReadinessChecks({
      ...PASSING_INPUT,
      hasConstitutionRatified: false,
    });
    const check = results.find((r) => r.name === 'constitution_ratified');
    expect(check?.passed).toBe(false);
    expect(check?.message).toMatch(/constitution/i);
  });

  it('school_profile_complete fails when no phase is configured', () => {
    const results = runReadinessChecks({ ...PASSING_INPUT, hasAtLeastOnePhase: false });
    const check = results.find((r) => r.name === 'school_profile_complete');
    expect(check?.passed).toBe(false);
  });

  it('school_profile_complete fails when no grade is configured', () => {
    const results = runReadinessChecks({ ...PASSING_INPUT, hasAtLeastOneGrade: false });
    const check = results.find((r) => r.name === 'school_profile_complete');
    expect(check?.passed).toBe(false);
  });

  it('school_profile_complete fails when no subject is configured', () => {
    const results = runReadinessChecks({ ...PASSING_INPUT, hasAtLeastOneSubject: false });
    const check = results.find((r) => r.name === 'school_profile_complete');
    expect(check?.passed).toBe(false);
  });

  it('subscription_active fails when subscription is not active', () => {
    const results = runReadinessChecks({ ...PASSING_INPUT, subscriptionActive: false });
    const check = results.find((r) => r.name === 'subscription_active');
    expect(check?.passed).toBe(false);
  });

  it('hasSourceConnected=false does NOT fail any check (advisory only)', () => {
    const results = runReadinessChecks({ ...PASSING_INPUT, hasSourceConnected: false });
    expect(allReadinessChecksPassed(results)).toBe(true);
  });
});

describe('allReadinessChecksPassed', () => {
  it('returns true when all checks pass', () => {
    const results = runReadinessChecks(PASSING_INPUT);
    expect(allReadinessChecksPassed(results)).toBe(true);
  });

  it('returns false when at least one check fails', () => {
    const results = runReadinessChecks({ ...PASSING_INPUT, staffCount: 0 });
    expect(allReadinessChecksPassed(results)).toBe(false);
  });

  it('returns true for an empty list (vacuously — no failing check)', () => {
    expect(allReadinessChecksPassed([])).toBe(true);
  });
});
