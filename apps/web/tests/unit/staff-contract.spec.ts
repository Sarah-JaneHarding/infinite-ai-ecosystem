import { SCHOOL_STAFF_ROLES } from '@infinite-ai/policy';
import { describe, expect, it } from 'vitest';

import {
  GrantRolesBody,
  GrantRolesResponse,
  IdParam,
  InvitationIdParam,
  InviteStaffBody,
  RevokeRoleBody,
  StaffActionResponse,
  InviteStaffResponse,
  RevokeInvitationResponse,
  refusalFor,
} from '../../src/lib/staff-contract.js';

// The staff-provisioning API contract (OQ-033 step 5 slice b): pins what a request may carry, and that
// every refusal the data layer can give has an answer that never echoes an address.
describe('InviteStaffBody', () => {
  const ok = { email: 'new@example.invalid', roles: ['teacher'] };

  it('accepts an address and one or more distinct school staff roles', () => {
    expect(InviteStaffBody.safeParse(ok).success).toBe(true);
    expect(
      InviteStaffBody.safeParse({ ...ok, roles: [...SCHOOL_STAFF_ROLES] }).success,
    ).toBe(true);
  });

  it.each(SCHOOL_STAFF_ROLES)('accepts %s', (role) => {
    expect(InviteStaffBody.safeParse({ ...ok, roles: [role] }).success).toBe(true);
  });

  it.each([
    ['platform_admin'],
    ['platform_support'],
    ['guardian'],
    ['learner'],
    ['superuser'],
    ['Teacher'],
    [''],
  ])('refuses the role %j — an invitation cannot carry it', (role) => {
    expect(InviteStaffBody.safeParse({ ...ok, roles: [role] }).success).toBe(false);
  });

  it.each([
    ['no roles', { ...ok, roles: [] }],
    ['a repeated role', { ...ok, roles: ['teacher', 'teacher'] }],
    ['roles not an array', { ...ok, roles: 'teacher' }],
    ['no email', { roles: ['teacher'] }],
    ['an empty email', { ...ok, email: '' }],
    ['an email over 254 characters', { ...ok, email: `${'a'.repeat(250)}@x.io` }],
    ['an email that is not a string', { ...ok, email: 7 }],
    ['nothing', {}],
    ['null', null],
  ])('refuses %s', (_name, body) => {
    expect(InviteStaffBody.safeParse(body).success).toBe(false);
  });

  it.each([
    'tenantId',
    'actorId',
    'actorAccountId',
    'schoolId',
    'role',
    'expiresAt',
    'userId',
  ])(
    'refuses a request that names %s — the session decides who and where, never the body',
    (key) => {
      expect(InviteStaffBody.safeParse({ ...ok, [key]: 'x' }).success).toBe(false);
    },
  );
});

describe('InvitationIdParam', () => {
  it('accepts a uuid and refuses anything else', () => {
    expect(
      InvitationIdParam.safeParse('5b1a0000-0000-4000-8000-0000000000aa').success,
    ).toBe(true);
    for (const bad of ['', 'x', '1', "' OR 1=1 --", '../etc', '5b1a0000']) {
      expect(InvitationIdParam.safeParse(bad).success, bad).toBe(false);
    }
  });
});

describe('responses', () => {
  it('pin the shapes the page reads', () => {
    expect(
      InviteStaffResponse.safeParse({
        invitationId: '5b1a0000-0000-4000-8000-0000000000aa',
        confirmation: 'AWAITING',
      }).success,
    ).toBe(true);
    expect(
      InviteStaffResponse.safeParse({ invitationId: 'x', confirmation: 'AWAITING' })
        .success,
    ).toBe(false);
    expect(RevokeInvitationResponse.safeParse({ revoked: true }).success).toBe(true);
    expect(RevokeInvitationResponse.safeParse({ revoked: false }).success).toBe(false);
  });
});

describe('refusalFor', () => {
  // Every reason createInvitation / revokeInvitation / the conferral rules can return.
  const KNOWN = [
    'actor_not_admin',
    'cannot_change_own_roles',
    'no_roles',
    'role_not_assignable',
    'invalid_email',
    'invalid_expiry',
    'email_in_use',
    'pending_invitation_exists',
    'staff_member_not_found',
    'staff_member_already_linked',
    'invitation_not_found',
    'invitation_not_pending',
    'confirmation_required',
    'target_not_found',
    'target_not_active',
    'role_already_held',
    'no_such_role',
    'role_not_sensitive',
    'no_confirmation_needed',
    'mixed_roles',
    'request_already_pending',
    'request_not_found',
    'request_not_pending',
    'request_expired',
    'confirmer_not_admin',
    'confirmer_is_actor',
    'confirmer_is_target',
    'confirmation_not_applicable',
    'decider_is_requester',
    'decider_is_target',
    'not_awaiting_confirmation',
    'invitation_expired',
    'proposer_unknown',
  ];

  it.each(KNOWN)('answers %s with a status and words, and no address', (reason) => {
    const refusal = refusalFor(reason);
    expect([403, 404, 409, 422]).toContain(refusal.status);
    expect(refusal.message.length).toBeGreaterThan(10);
    expect(refusal.message).not.toMatch(/\S+@\S+/);
    expect(refusal.message).not.toContain(reason);
  });

  it('maps authority to 403, absence to 404 and conflicts to 409', () => {
    expect(refusalFor('actor_not_admin').status).toBe(403);
    expect(refusalFor('invitation_not_found').status).toBe(404);
    expect(refusalFor('email_in_use').status).toBe(409);
    expect(refusalFor('pending_invitation_exists').status).toBe(409);
    expect(refusalFor('invitation_not_pending').status).toBe(409);
  });

  it('answers a reason it does not know with a generic 422, never echoing it', () => {
    const refusal = refusalFor('some_new_reason');
    expect(refusal.status).toBe(422);
    expect(refusal.message).not.toContain('some_new_reason');
  });
});

describe('GrantRolesBody', () => {
  it.each(SCHOOL_STAFF_ROLES)('accepts %s', (role) => {
    expect(GrantRolesBody.safeParse({ roles: [role] }).success).toBe(true);
  });

  it.each([
    ['no roles', { roles: [] }],
    ['a repeated role', { roles: ['hod', 'hod'] }],
    ['a platform role', { roles: ['platform_admin'] }],
    ['a guardian', { roles: ['guardian'] }],
    ['roles not an array', { roles: 'hod' }],
    ['nothing', {}],
    [
      'an address (this is for an existing account)',
      { roles: ['hod'], email: 'a@example.invalid' },
    ],
    ['a target in the body', { roles: ['hod'], targetAccountId: 'x' }],
    ['a school', { roles: ['hod'], schoolId: 'x' }],
  ])('refuses %s', (_name, body) => {
    expect(GrantRolesBody.safeParse(body).success).toBe(false);
  });

  it('pins the response shape', () => {
    for (const outcome of ['granted', 'requested', 'applied']) {
      expect(GrantRolesResponse.safeParse({ outcome }).success).toBe(true);
    }
    expect(GrantRolesResponse.safeParse({ outcome: 'maybe' }).success).toBe(false);
  });
});

describe('RevokeRoleBody', () => {
  it.each(SCHOOL_STAFF_ROLES)('accepts %s', (role) => {
    expect(RevokeRoleBody.safeParse({ role }).success).toBe(true);
  });

  it.each([
    ['a platform role', { role: 'platform_admin' }],
    ['an array', { role: ['hod'] }],
    ['no role', {}],
    ['an extra key', { role: 'hod', targetAccountId: 'x' }],
  ])('refuses %s', (_name, body) => {
    expect(RevokeRoleBody.safeParse(body).success).toBe(false);
  });
});

describe('IdParam and the generic action response', () => {
  it('IdParam is the same uuid rule the invitation id uses', () => {
    expect(IdParam).toBe(InvitationIdParam);
    expect(IdParam.safeParse("x' OR 1=1").success).toBe(false);
  });

  it('StaffActionResponse is exactly { done: true }', () => {
    expect(StaffActionResponse.safeParse({ done: true }).success).toBe(true);
    expect(StaffActionResponse.safeParse({ done: false }).success).toBe(false);
  });
});
