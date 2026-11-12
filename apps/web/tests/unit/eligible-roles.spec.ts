import { Role } from '@infinite-ai/policy';
import { describe, expect, it } from 'vitest';

import { eligibleRoles } from '../../src/lib/eligible-roles.js';

const STAFF: Role[] = ['teacher', 'hod', 'smt', 'sbst', 'sbst_chair', 'admin'];
const OTHER: Role[] = ['guardian', 'learner', 'platform_support', 'platform_admin'];

describe('eligibleRoles — school staff roles need the claim AND the school’s grant', () => {
  it.each(STAFF)('%s: claimed and granted → eligible', (role) => {
    expect(eligibleRoles({ claimRoles: [role], assignedRoles: [role] })).toEqual({
      eligible: [role],
      assignedNotClaimed: [],
      claimedNotAssigned: [],
    });
  });

  it.each(STAFF)('%s: claimed but never granted → not eligible, reported', (role) => {
    expect(eligibleRoles({ claimRoles: [role], assignedRoles: [] })).toEqual({
      eligible: [],
      assignedNotClaimed: [],
      claimedNotAssigned: [role],
    });
  });

  it.each(STAFF)('%s: granted but not claimed → not eligible, reported', (role) => {
    expect(eligibleRoles({ claimRoles: [], assignedRoles: [role] })).toEqual({
      eligible: [],
      assignedNotClaimed: [role],
      claimedNotAssigned: [],
    });
  });

  it.each(STAFF)('%s: neither → nothing', (role) => {
    const result = eligibleRoles({ claimRoles: [], assignedRoles: [] });
    expect(result.eligible).not.toContain(role);
  });
});

describe('eligibleRoles — roles the school does not grant follow the claim alone', () => {
  it.each(OTHER)('%s: claimed → eligible, with or without an assignment', (role) => {
    expect(eligibleRoles({ claimRoles: [role], assignedRoles: [] }).eligible).toEqual([
      role,
    ]);
    expect(eligibleRoles({ claimRoles: [role], assignedRoles: [role] }).eligible).toEqual(
      [role],
    );
  });

  it.each(OTHER)('%s: not claimed → not eligible, even if somehow assigned', (role) => {
    const result = eligibleRoles({ claimRoles: [], assignedRoles: [role] });
    expect(result.eligible).toEqual([]);
    expect(result.assignedNotClaimed).toEqual([]);
    expect(result.claimedNotAssigned).toEqual([]);
  });
});

describe('eligibleRoles — order and duplicates', () => {
  it('returns roles in the fixed Role order whatever order they arrive in — no precedence', () => {
    const forward = eligibleRoles({
      claimRoles: ['admin', 'teacher', 'learner'],
      assignedRoles: ['teacher', 'admin'],
    });
    const backward = eligibleRoles({
      claimRoles: ['learner', 'teacher', 'admin'],
      assignedRoles: ['admin', 'teacher'],
    });
    expect(forward.eligible).toEqual(['teacher', 'admin', 'learner']);
    expect(backward.eligible).toEqual(forward.eligible);
    const indexes = forward.eligible.map((r) => Role.options.indexOf(r));
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  });

  it('lists a repeated role once', () => {
    expect(
      eligibleRoles({
        claimRoles: ['hod', 'hod'],
        assignedRoles: ['hod', 'hod'],
      }).eligible,
    ).toEqual(['hod']);
  });

  it('handles a mix: several eligible, one granted-only, one claimed-only', () => {
    expect(
      eligibleRoles({
        claimRoles: ['teacher', 'hod', 'smt'],
        assignedRoles: ['teacher', 'hod', 'sbst'],
      }),
    ).toEqual({
      eligible: ['teacher', 'hod'],
      assignedNotClaimed: ['sbst'],
      claimedNotAssigned: ['smt'],
    });
  });
});
