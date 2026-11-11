import { describe, expect, it } from 'vitest';

import {
  Action,
  PLATFORM_ROLES,
  type ResourceType,
  Role,
  authorize,
  type Actor,
  type Resource,
} from '../src/rbac.js';
import {
  CONFIRMATION_REQUIRED_ROLES,
  SCHOOL_STAFF_ROLES,
  evaluateAccountStatusChange,
  evaluateRoleConferral,
  evaluateRoleRevocation,
  isSchoolStaffRole,
  type AdminState,
  type RoleConferral,
} from '../src/provisioning.js';

// OQ-033 step 2. Two layers, tested separately: the permission matrix (may an administrator do
// this kind of thing at all) and the guard-rails (is *this* grant, by *this* person, to *that*
// person, allowed).

const TENANT = '11111111-1111-4111-8111-111111111111';
const OTHER_TENANT = '22222222-2222-4222-8222-222222222222';
const USER = '33333333-3333-4333-8333-333333333333';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const NOW = new Date('2026-10-24T09:00:00.000Z');

const PROVISIONING: readonly ResourceType[] = [
  'user_account',
  'role_assignment',
  'user_invitation',
];

const actorWith = (
  role: Role,
  over: Partial<Actor> = {},
  expiresAt: Date | null = null,
): Actor => ({
  userId: USER,
  tenantId: TENANT,
  grants: [{ role, schoolId: null, classGroupId: null, subjectId: null, expiresAt }],
  guardianOfLearnerIds: [],
  impersonating: false,
  ...over,
});

const resourceOf = (type: ResourceType, tenantId = TENANT): Resource => ({
  type,
  tenantId,
  schoolId: null,
  classGroupId: null,
  subjectId: null,
  learnerId: null,
  ownerId: null,
});

// ---------------------------------------------------------------------------
// The matrix
// ---------------------------------------------------------------------------

describe('the permission matrix for provisioning resources', () => {
  const ADMIN_MAY: ReadonlyArray<readonly [ResourceType, Action]> = [
    ['user_account', 'read'],
    ['user_account', 'update'],
    ['role_assignment', 'read'],
    ['role_assignment', 'create'],
    ['role_assignment', 'delete'],
    ['role_assignment', 'approve'],
    ['user_invitation', 'read'],
    ['user_invitation', 'create'],
    ['user_invitation', 'update'],
  ];

  it.each(ADMIN_MAY)('lets an administrator %s: %s', (type, action) => {
    const decision = authorize(actorWith('admin'), action, resourceOf(type), NOW);
    expect(decision.allowed).toBe(true);
  });

  it('grants an administrator exactly those nine actions on these resources, and no others', () => {
    const allowed: string[] = [];
    for (const type of PROVISIONING) {
      for (const action of Action.options) {
        if (authorize(actorWith('admin'), action, resourceOf(type), NOW).allowed) {
          allowed.push(`${type}:${action}`);
        }
      }
    }
    expect(allowed.sort()).toEqual(ADMIN_MAY.map(([t, a]) => `${t}:${a}`).sort());
  });

  it('gives an administrator no way to create an account directly', () => {
    // An account exists only because a person signed in and was linked to an invitation.
    const decision = authorize(
      actorWith('admin'),
      'create',
      resourceOf('user_account'),
      NOW,
    );
    expect(decision.allowed).toBe(false);
  });

  it.each(Role.options.filter((r) => r !== 'admin'))(
    'refuses every provisioning action to %s, even impersonating',
    (role) => {
      for (const type of PROVISIONING) {
        for (const action of Action.options) {
          const decision = authorize(
            actorWith(role, { impersonating: true, guardianOfLearnerIds: [USER] }),
            action,
            resourceOf(type),
            NOW,
          );
          expect(decision.allowed, `${role} must not ${action} ${type}`).toBe(false);
        }
      }
    },
  );

  it('keeps platform staff out of a school’s accounts and roles', () => {
    for (const role of PLATFORM_ROLES) {
      const decision = authorize(
        actorWith(role, { impersonating: true }),
        'read',
        resourceOf('role_assignment'),
        NOW,
      );
      expect(decision.allowed).toBe(false);
    }
  });

  it('refuses an administrator of another school', () => {
    const decision = authorize(
      actorWith('admin'),
      'create',
      resourceOf('role_assignment', OTHER_TENANT),
      NOW,
    );
    expect(decision).toEqual({ allowed: false, reason: 'cross_tenant' });
  });

  it('refuses an administrator whose grant has lapsed', () => {
    const lapsed = actorWith('admin', {}, new Date('2026-10-01T00:00:00.000Z'));
    const decision = authorize(lapsed, 'create', resourceOf('role_assignment'), NOW);
    expect(decision).toEqual({ allowed: false, reason: 'grant_expired' });
  });
});

// ---------------------------------------------------------------------------
// The role list
// ---------------------------------------------------------------------------

describe('the school staff roles', () => {
  it('are real roles and exclude every platform role, guardian and learner', () => {
    for (const role of SCHOOL_STAFF_ROLES)
      expect(Role.safeParse(role).success).toBe(true);
    for (const role of [...PLATFORM_ROLES, 'guardian', 'learner']) {
      expect(isSchoolStaffRole(role)).toBe(false);
    }
  });

  it('are the roles whose confirmation rule is defined (admin and smt only)', () => {
    expect([...CONFIRMATION_REQUIRED_ROLES].sort()).toEqual(['admin', 'smt']);
    for (const role of CONFIRMATION_REQUIRED_ROLES) {
      expect(isSchoolStaffRole(role)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Conferring roles
// ---------------------------------------------------------------------------

const two: AdminState = { activeAdminAccountIds: [A, B] };
const sole: AdminState = { activeAdminAccountIds: [A] };

const grantTo = (over: Partial<RoleConferral>): RoleConferral => ({
  actorAccountId: A,
  target: { kind: 'account', accountId: C },
  roles: ['teacher'],
  admins: two,
  ...over,
});

describe('evaluateRoleConferral', () => {
  it.each([['teacher'], ['hod'], ['sbst'], ['teacher', 'hod']])(
    'lets an administrator grant %s with no confirmation',
    (...roles) => {
      expect(evaluateRoleConferral(grantTo({ roles }))).toEqual({
        allowed: true,
        confirmation: 'not_required',
        confirmedBy: null,
      });
    },
  );

  it('treats an invitation the same way as a grant to an account', () => {
    const invite = grantTo({ target: { kind: 'invitation', isActorsOwnAddress: false } });
    expect(evaluateRoleConferral(invite)).toMatchObject({ allowed: true });
  });

  it('refuses someone who is not an active administrator', () => {
    for (const actorAccountId of [C, 'unknown']) {
      expect(evaluateRoleConferral(grantTo({ actorAccountId }))).toEqual({
        allowed: false,
        reason: 'actor_not_admin',
      });
    }
  });

  it('refuses an empty role list', () => {
    expect(evaluateRoleConferral(grantTo({ roles: [] }))).toEqual({
      allowed: false,
      reason: 'no_roles',
    });
  });

  it.each([
    ['a platform admin role', ['platform_admin']],
    ['a platform support role', ['platform_support']],
    ['a guardian role', ['guardian']],
    ['a learner role', ['learner']],
    ['an unknown role', ['superuser']],
    ['a staff role mixed with a platform role', ['teacher', 'platform_admin']],
    ['a role with the wrong case', ['Admin']],
  ])('refuses %s', (_what, roles) => {
    expect(evaluateRoleConferral(grantTo({ roles }))).toEqual({
      allowed: false,
      reason: 'role_not_assignable',
    });
  });

  it('refuses an administrator changing their own roles — directly or by inviting themselves', () => {
    expect(
      evaluateRoleConferral(grantTo({ target: { kind: 'account', accountId: A } })),
    ).toEqual({ allowed: false, reason: 'cannot_change_own_roles' });
    expect(
      evaluateRoleConferral(
        grantTo({ target: { kind: 'invitation', isActorsOwnAddress: true } }),
      ),
    ).toEqual({ allowed: false, reason: 'cannot_change_own_roles' });
  });

  describe('admin and smt need a second administrator when the school has one', () => {
    it.each([['admin'], ['smt'], ['teacher', 'smt']])(
      'asks for confirmation to grant %s',
      (...roles) => {
        expect(evaluateRoleConferral(grantTo({ roles }))).toEqual({
          allowed: false,
          reason: 'confirmation_required',
        });
      },
    );

    it('accepts another administrator’s confirmation and records who gave it', () => {
      expect(
        evaluateRoleConferral(grantTo({ roles: ['admin'], confirmedByAccountId: B })),
      ).toEqual({ allowed: true, confirmation: 'confirmed', confirmedBy: B });
    });

    it('refuses a confirmation from the actor', () => {
      expect(
        evaluateRoleConferral(grantTo({ roles: ['smt'], confirmedByAccountId: A })),
      ).toEqual({ allowed: false, reason: 'confirmer_is_actor' });
    });

    it('refuses a confirmation from the person receiving the role', () => {
      const admins: AdminState = { activeAdminAccountIds: [A, B, C] };
      expect(
        evaluateRoleConferral(
          grantTo({ roles: ['admin'], admins, confirmedByAccountId: C }),
        ),
      ).toEqual({ allowed: false, reason: 'confirmer_is_target' });
    });

    it('refuses a confirmation from someone who is not an active administrator', () => {
      // Neither the actor (A), the target (C) nor an administrator.
      const outsider = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
      expect(
        evaluateRoleConferral(
          grantTo({ roles: ['admin'], confirmedByAccountId: outsider }),
        ),
      ).toEqual({ allowed: false, reason: 'confirmer_not_admin' });
    });

    it('does not need, and does not record, a confirmation for roles that do not require one', () => {
      expect(
        evaluateRoleConferral(grantTo({ roles: ['hod'], confirmedByAccountId: B })),
      ).toEqual({ allowed: true, confirmation: 'not_required', confirmedBy: null });
    });
  });

  describe('a school with a single administrator', () => {
    it('can still appoint admin and smt, and the exception is named for the audit', () => {
      for (const roles of [['admin'], ['smt']]) {
        expect(evaluateRoleConferral(grantTo({ roles, admins: sole }))).toEqual({
          allowed: true,
          confirmation: 'waived_sole_admin',
          confirmedBy: null,
        });
      }
    });

    it('counts a duplicated id once — two entries for one person is still one administrator', () => {
      const duplicated: AdminState = { activeAdminAccountIds: [A, A] };
      expect(
        evaluateRoleConferral(grantTo({ roles: ['admin'], admins: duplicated })),
      ).toEqual({
        allowed: true,
        confirmation: 'waived_sole_admin',
        confirmedBy: null,
      });
    });

    it('still refuses self-appointment and non-staff roles', () => {
      expect(
        evaluateRoleConferral(
          grantTo({
            admins: sole,
            target: { kind: 'account', accountId: A },
            roles: ['admin'],
          }),
        ),
      ).toEqual({ allowed: false, reason: 'cannot_change_own_roles' });
      expect(
        evaluateRoleConferral(grantTo({ admins: sole, roles: ['platform_admin'] })),
      ).toEqual({ allowed: false, reason: 'role_not_assignable' });
    });
  });

  it('refuses every actor when the school has no administrator at all', () => {
    const none: AdminState = { activeAdminAccountIds: [] };
    expect(evaluateRoleConferral(grantTo({ admins: none }))).toEqual({
      allowed: false,
      reason: 'actor_not_admin',
    });
  });
});

// ---------------------------------------------------------------------------
// Removing authority
// ---------------------------------------------------------------------------

describe('evaluateRoleRevocation and evaluateAccountStatusChange', () => {
  it('lets an administrator revoke a role from, or suspend, someone else', () => {
    expect(
      evaluateRoleRevocation({
        actorAccountId: A,
        targetAccountId: C,
        role: 'teacher',
        admins: two,
      }),
    ).toMatchObject({ allowed: true });
    expect(
      evaluateAccountStatusChange({ actorAccountId: A, targetAccountId: C, admins: two }),
    ).toMatchObject({ allowed: true });
  });

  it('lets one of two administrators demote the other', () => {
    expect(
      evaluateRoleRevocation({
        actorAccountId: A,
        targetAccountId: B,
        role: 'admin',
        admins: two,
      }),
    ).toMatchObject({ allowed: true });
  });

  it('refuses anyone who is not an active administrator', () => {
    expect(
      evaluateRoleRevocation({
        actorAccountId: C,
        targetAccountId: B,
        role: 'teacher',
        admins: two,
      }),
    ).toEqual({ allowed: false, reason: 'actor_not_admin' });
    expect(
      evaluateAccountStatusChange({ actorAccountId: C, targetAccountId: B, admins: two }),
    ).toEqual({ allowed: false, reason: 'actor_not_admin' });
  });

  it('refuses changing your own roles or status', () => {
    expect(
      evaluateRoleRevocation({
        actorAccountId: A,
        targetAccountId: A,
        role: 'admin',
        admins: two,
      }),
    ).toEqual({ allowed: false, reason: 'cannot_change_own_roles' });
    expect(
      evaluateAccountStatusChange({ actorAccountId: A, targetAccountId: A, admins: two }),
    ).toEqual({ allowed: false, reason: 'cannot_change_own_status' });
  });

  it('can never remove a school’s last administrator in one change — checked exhaustively', () => {
    // The rule has no branch of its own: it holds because the actor must be an administrator
    // and cannot be the target. This checks that over every small school and every pairing,
    // rather than trusting the argument. (A *race* between two administrators is a different
    // hazard, closed in the committing transaction — see the note on evaluateRoleRevocation.)
    const people = [A, B, C, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'];
    const subsets: string[][] = [];
    for (let mask = 0; mask < 1 << people.length; mask++) {
      subsets.push(people.filter((_, i) => (mask & (1 << i)) !== 0));
    }
    let allowedRemovals = 0;
    for (const admins of subsets) {
      for (const actor of people) {
        for (const target of people) {
          const revoke = evaluateRoleRevocation({
            actorAccountId: actor,
            targetAccountId: target,
            role: 'admin',
            admins: { activeAdminAccountIds: admins },
          });
          const suspend = evaluateAccountStatusChange({
            actorAccountId: actor,
            targetAccountId: target,
            admins: { activeAdminAccountIds: admins },
          });
          for (const decision of [revoke, suspend]) {
            if (!decision.allowed) continue;
            allowedRemovals += 1;
            const remaining = admins.filter((id) => id !== target);
            expect(
              remaining.length,
              `admins=${admins.join(',')} actor=${actor} target=${target}`,
            ).toBeGreaterThanOrEqual(1);
          }
        }
      }
    }
    expect(allowedRemovals).toBeGreaterThan(0); // not vacuous
  });
});
