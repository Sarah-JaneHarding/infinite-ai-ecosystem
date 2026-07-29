// The authorisation matrix — Stage 02 steps 8 and 9.
//
// The exit gate requires a generated test that iterates every role against every
// permission, "so a permission change cannot silently widen access". That is the
// `exhaustive matrix` block below: it derives its cases from PERMISSIONS itself, so adding
// a row to the matrix adds a test without anyone remembering to.

import { describe, expect, it } from 'vitest';

import {
  Action,
  PERMISSIONS,
  Role,
  ResourceType,
  authorize,
  type Actor,
  type Resource,
  type RoleGrant,
} from '../src/rbac.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const OTHER_TENANT = '22222222-2222-4222-8222-222222222222';
const USER = '33333333-3333-4333-8333-333333333333';
const SCHOOL = '44444444-4444-4444-8444-444444444444';
const CLASS = '55555555-5555-4555-8555-555555555555';
const SUBJECT = '66666666-6666-4666-8666-666666666666';
const LEARNER = '77777777-7777-4777-8777-777777777777';

const grantOf = (role: Role, over: Partial<RoleGrant> = {}): RoleGrant => ({
  role,
  schoolId: SCHOOL,
  classGroupId: CLASS,
  subjectId: SUBJECT,
  expiresAt: null,
  ...over,
});

const actorWith = (grants: RoleGrant[], over: Partial<Actor> = {}): Actor => ({
  userId: USER,
  tenantId: TENANT,
  grants,
  guardianOfLearnerIds: [],
  impersonating: false,
  ...over,
});

const resourceOf = (type: ResourceType, over: Partial<Resource> = {}): Resource => ({
  type,
  tenantId: TENANT,
  schoolId: SCHOOL,
  classGroupId: CLASS,
  subjectId: SUBJECT,
  learnerId: null,
  ownerId: USER,
  ...over,
});

// ---------------------------------------------------------------------------
// The generated matrix test the exit gate asks for
// ---------------------------------------------------------------------------

describe('exhaustive matrix', () => {
  it.each(PERMISSIONS)(
    'allows $role to $action $resource at $scope when in scope',
    (permission) => {
      const actor = actorWith([grantOf(permission.role)], {
        ...(permission.role === 'guardian' ? { guardianOfLearnerIds: [LEARNER] } : {}),
        // A PLATFORM-scope grant is only usable inside an impersonation session, so the
        // in-scope case for a platform role necessarily includes one. That the generic
        // case failed without it is the constraint doing its job.
        ...(permission.scope === 'PLATFORM' ? { impersonating: true } : {}),
      });
      const resource = resourceOf(
        permission.resource,
        permission.role === 'guardian' ? { learnerId: LEARNER } : {},
      );
      const decision = authorize(actor, permission.action, resource);
      expect(decision.allowed, `${permission.role} should be allowed`).toBe(true);
    },
  );

  it.each(PERMISSIONS)(
    'refuses $role $action $resource across a tenant boundary',
    (permission) => {
      // The one assertion that must hold for every row without exception.
      const actor = actorWith([grantOf(permission.role)], {
        guardianOfLearnerIds: [LEARNER],
      });
      const foreign = resourceOf(permission.resource, {
        tenantId: OTHER_TENANT,
        learnerId: LEARNER,
      });
      const decision = authorize(actor, permission.action, foreign);
      if (permission.scope === 'PLATFORM') {
        // Platform roles may cross tenants, but only inside an impersonation session.
        expect(decision.allowed).toBe(false);
      } else {
        expect(decision.allowed).toBe(false);
        if (!decision.allowed) expect(decision.reason).toBe('cross_tenant');
      }
    },
  );

  it('grants no role any action it is not explicitly given', () => {
    // The complement of the matrix. Anything not in PERMISSIONS must be denied, which is
    // what makes the matrix the whole policy rather than most of it.
    const declared = new Set(
      PERMISSIONS.map((p) => `${p.role}:${p.resource}:${p.action}`),
    );
    for (const role of Role.options) {
      for (const type of ResourceType.options) {
        for (const action of Action.options) {
          if (declared.has(`${role}:${type}:${action}`)) continue;
          const actor = actorWith([grantOf(role)], {
            guardianOfLearnerIds: [LEARNER],
            impersonating: true,
          });
          const decision = authorize(
            actor,
            action,
            resourceOf(type, { learnerId: LEARNER }),
          );
          expect(
            decision.allowed,
            `${role} must not be able to ${action} ${type} — it is not in the matrix`,
          ).toBe(false);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The specific protections the manual names
// ---------------------------------------------------------------------------

describe('learner identifiers are never reachable through RBAC', () => {
  it.each(Role.options)('refuses %s', (role) => {
    // Re-identification goes through the audited de-identification API in Stage 03, not
    // through ordinary authorisation. No role, at any scope, gets there this way.
    const actor = actorWith([grantOf(role)], { impersonating: true });
    const decision = authorize(actor, 'read', resourceOf('learner_identifier'));
    expect(decision.allowed).toBe(false);
    if (!decision.allowed)
      expect(decision.reason).toBe('resource_never_granted_via_rbac');
  });
});

describe('a teacher is confined to their own class', () => {
  it('reads a learner in their class', () => {
    const actor = actorWith([grantOf('teacher')]);
    expect(authorize(actor, 'read', resourceOf('learner')).allowed).toBe(true);
  });

  it('cannot read a learner in another class', () => {
    const actor = actorWith([grantOf('teacher')]);
    const other = resourceOf('learner', {
      classGroupId: '99999999-9999-4999-8999-999999999999',
    });
    const decision = authorize(actor, 'read', other);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toBe('scope_not_satisfied');
  });

  it('cannot approve its own lesson plan', () => {
    // Approval is an HoD action. A teacher approving their own work would make the human
    // gate self-signed, which is not a gate.
    const actor = actorWith([grantOf('teacher')]);
    expect(authorize(actor, 'approve', resourceOf('lesson_plan')).allowed).toBe(false);
  });
});

describe('a guardian reaches only their own children', () => {
  it('reads a linked learner', () => {
    const actor = actorWith([grantOf('guardian')], { guardianOfLearnerIds: [LEARNER] });
    expect(
      authorize(actor, 'read', resourceOf('learner', { learnerId: LEARNER })).allowed,
    ).toBe(true);
  });

  it('cannot read an unlinked learner in the same school', () => {
    const actor = actorWith([grantOf('guardian')], { guardianOfLearnerIds: [LEARNER] });
    const someoneElse = resourceOf('learner', {
      learnerId: '88888888-8888-4888-8888-888888888888',
    });
    const decision = authorize(actor, 'read', someoneElse);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toBe('not_guardian_of_learner');
  });

  it('cannot read a learner when the resource names no learner at all', () => {
    // A missing learnerId must fail closed rather than matching everything.
    const actor = actorWith([grantOf('guardian')], { guardianOfLearnerIds: [LEARNER] });
    expect(
      authorize(actor, 'read', resourceOf('learner', { learnerId: null })).allowed,
    ).toBe(false);
  });

  it('cannot write anything', () => {
    const actor = actorWith([grantOf('guardian')], { guardianOfLearnerIds: [LEARNER] });
    for (const action of ['create', 'update', 'delete', 'approve', 'export'] as const) {
      expect(
        authorize(actor, action, resourceOf('learner', { learnerId: LEARNER })).allowed,
        `guardian must not ${action}`,
      ).toBe(false);
    }
  });
});

describe('platform roles', () => {
  it('cannot act in a tenant without an impersonation session', () => {
    const actor = actorWith([grantOf('platform_support')], {
      tenantId: OTHER_TENANT,
      impersonating: false,
    });
    const decision = authorize(actor, 'read', resourceOf('tenant_setting'));
    expect(decision.allowed).toBe(false);
    if (!decision.allowed)
      expect(decision.reason).toBe('platform_role_not_impersonating');
  });

  it('can act once impersonating', () => {
    const actor = actorWith([grantOf('platform_support')], {
      tenantId: OTHER_TENANT,
      impersonating: true,
    });
    expect(authorize(actor, 'read', resourceOf('tenant_setting')).allowed).toBe(true);
  });

  it('cannot read learner data even while impersonating', () => {
    // Platform staff have no business in a child's record. The guarantee is that no such
    // grant exists, so there is nothing to misconfigure.
    for (const role of ['platform_support', 'platform_admin'] as const) {
      const actor = actorWith([grantOf(role)], {
        tenantId: OTHER_TENANT,
        impersonating: true,
      });
      for (const type of ['learner', 'screening_result', 'sbst_case'] as const) {
        expect(
          authorize(actor, 'read', resourceOf(type)).allowed,
          `${role} must not read ${type}`,
        ).toBe(false);
      }
    }
  });

  it('platform_support cannot write tenant settings', () => {
    const actor = actorWith([grantOf('platform_support')], {
      tenantId: OTHER_TENANT,
      impersonating: true,
    });
    expect(authorize(actor, 'update', resourceOf('tenant_setting')).allowed).toBe(false);
  });
});

describe('negative cases the manual names', () => {
  it('refuses a role that expired mid-session, and says why', () => {
    const expired = grantOf('teacher', { expiresAt: new Date('2026-01-01T00:00:00Z') });
    const actor = actorWith([expired]);
    const decision = authorize(
      actor,
      'read',
      resourceOf('learner'),
      new Date('2026-07-01'),
    );
    expect(decision.allowed).toBe(false);
    // "expired" and "never had permission" send an administrator to different fixes.
    if (!decision.allowed) expect(decision.reason).toBe('grant_expired');
  });

  it('honours a grant that has not yet expired', () => {
    const active = grantOf('teacher', { expiresAt: new Date('2026-12-31T00:00:00Z') });
    const actor = actorWith([active]);
    expect(
      authorize(actor, 'read', resourceOf('learner'), new Date('2026-07-01')).allowed,
    ).toBe(true);
  });

  it('refuses an actor with no grants at all', () => {
    expect(authorize(actorWith([]), 'read', resourceOf('learner')).allowed).toBe(false);
  });

  it('refuses when the token names a different tenant to the resource', () => {
    const actor = actorWith([grantOf('smt')], { tenantId: OTHER_TENANT });
    const decision = authorize(actor, 'read', resourceOf('learner'));
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toBe('cross_tenant');
  });

  it('takes the widest applicable grant when an actor holds several roles', () => {
    // A teacher who is also an HoD should get HoD reach, not be capped at teacher reach.
    const actor = actorWith([
      grantOf('teacher', { classGroupId: CLASS }),
      grantOf('hod', { classGroupId: null }),
    ]);
    const otherClass = resourceOf('lesson_plan', {
      classGroupId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      subjectId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });
    expect(authorize(actor, 'approve', otherClass).allowed).toBe(true);
  });
});
