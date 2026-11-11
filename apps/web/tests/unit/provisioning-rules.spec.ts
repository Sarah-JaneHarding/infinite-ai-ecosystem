// The facade must be the real policy, not a copy: these run the rules through the interface the
// data layer calls them by and check the decisions that matter most to it.

import { describe, expect, it } from 'vitest';

import { provisioningRules } from '../../src/lib/provisioning-rules';

const ADMIN_A = '00000000-0000-4000-8000-00000000000a';
const ADMIN_B = '00000000-0000-4000-8000-00000000000b';
const TEACHER = '00000000-0000-4000-8000-0000000000c1';

const twoAdmins = { activeAdminAccountIds: [ADMIN_A, ADMIN_B] };
const oneAdmin = { activeAdminAccountIds: [ADMIN_A] };

describe('provisioningRules (the real policy, through the db interface)', () => {
  it('lets an administrator invite a teacher with no confirmation', () => {
    expect(
      provisioningRules.conferral({
        actorAccountId: ADMIN_A,
        target: { kind: 'invitation', isActorsOwnAddress: false },
        roles: ['teacher'],
        admins: twoAdmins,
      }),
    ).toEqual({ allowed: true, confirmation: 'not_required', confirmedBy: null });
  });

  it('asks for a second administrator when two exist, and waives it for a sole administrator', () => {
    const input = {
      actorAccountId: ADMIN_A,
      target: { kind: 'invitation', isActorsOwnAddress: false } as const,
      roles: ['admin'],
    };
    expect(provisioningRules.conferral({ ...input, admins: twoAdmins })).toEqual({
      allowed: false,
      reason: 'confirmation_required',
    });
    expect(provisioningRules.conferral({ ...input, admins: oneAdmin })).toMatchObject({
      allowed: true,
      confirmation: 'waived_sole_admin',
    });
    expect(
      provisioningRules.conferral({
        ...input,
        admins: twoAdmins,
        confirmedByAccountId: ADMIN_B,
      }),
    ).toMatchObject({ allowed: true, confirmation: 'confirmed', confirmedBy: ADMIN_B });
  });

  it.each([
    [
      'a non-administrator inviting',
      () =>
        provisioningRules.conferral({
          actorAccountId: TEACHER,
          target: { kind: 'invitation', isActorsOwnAddress: false },
          roles: ['teacher'],
          admins: twoAdmins,
        }),
      'actor_not_admin',
    ],
    [
      'inviting a platform role',
      () =>
        provisioningRules.conferral({
          actorAccountId: ADMIN_A,
          target: { kind: 'invitation', isActorsOwnAddress: false },
          roles: ['platform_admin'],
          admins: twoAdmins,
        }),
      'role_not_assignable',
    ],
    [
      'an administrator inviting their own address',
      () =>
        provisioningRules.conferral({
          actorAccountId: ADMIN_A,
          target: { kind: 'invitation', isActorsOwnAddress: true },
          roles: ['teacher'],
          admins: twoAdmins,
        }),
      'cannot_change_own_roles',
    ],
    [
      'revoking your own role',
      () =>
        provisioningRules.revocation({
          actorAccountId: ADMIN_A,
          targetAccountId: ADMIN_A,
          role: 'admin',
          admins: twoAdmins,
        }),
      'cannot_change_own_roles',
    ],
    [
      'suspending yourself',
      () =>
        provisioningRules.statusChange({
          actorAccountId: ADMIN_A,
          targetAccountId: ADMIN_A,
          admins: twoAdmins,
        }),
      'cannot_change_own_status',
    ],
  ])('refuses %s', (_what, decide, reason) => {
    expect(decide()).toEqual({ allowed: false, reason });
  });

  it('lets one administrator revoke and suspend another', () => {
    expect(
      provisioningRules.revocation({
        actorAccountId: ADMIN_A,
        targetAccountId: ADMIN_B,
        role: 'admin',
        admins: twoAdmins,
      }),
    ).toMatchObject({ allowed: true });
    expect(
      provisioningRules.statusChange({
        actorAccountId: ADMIN_A,
        targetAccountId: ADMIN_B,
        admins: twoAdmins,
      }),
    ).toMatchObject({ allowed: true });
  });
});
