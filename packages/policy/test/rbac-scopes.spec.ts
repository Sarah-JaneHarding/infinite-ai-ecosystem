// Scope resolution and the throwing entry point.
//
// These paths were uncovered when §4.2's 95% floor first ran against `packages/policy`.
// They are not obscure corners: `assertAuthorized` is the exported form most call sites
// will use, and the scope branches below decide which children a teacher or an HoD can
// read. Each case here is a sentence about who may see a learner's record.

import { describe, expect, it } from 'vitest';

import {
  AuthorizationError,
  assertAuthorized,
  authorize,
  type Actor,
  type Resource,
  type Role,
  type RoleGrant,
} from '../src/rbac.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const USER = '33333333-3333-4333-8333-333333333333';
const OTHER_USER = '99999999-9999-4999-8999-999999999999';
const SCHOOL = '44444444-4444-4444-8444-444444444444';
const OTHER_SCHOOL = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CLASS = '55555555-5555-4555-8555-555555555555';
const OTHER_CLASS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SUBJECT = '66666666-6666-4666-8666-666666666666';
const OTHER_SUBJECT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
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

const resourceOf = (type: Resource['type'], over: Partial<Resource> = {}): Resource => ({
  type,
  tenantId: TENANT,
  schoolId: SCHOOL,
  classGroupId: CLASS,
  subjectId: SUBJECT,
  learnerId: null,
  ownerId: USER,
  ...over,
});

describe('OWN_SCHOOL', () => {
  it('reaches the whole tenant when the grant names no school', () => {
    // A school-scoped role granted tenant-wide — an HoD at a single-campus school, or one
    // appointed across a school group. Null means "not narrowed", not "narrowed to
    // nothing", and reading it the other way would lock out every such appointment.
    const actor = actorWith([grantOf('hod', { schoolId: null })]);
    const decision = authorize(
      actor,
      'read',
      resourceOf('learner', { schoolId: OTHER_SCHOOL }),
    );
    expect(decision.allowed).toBe(true);
  });

  it('does not reach another campus when the grant names one', () => {
    // The two-campus school group is exactly why this matters: an HoD at one campus has no
    // business reading learners at the other.
    const actor = actorWith([grantOf('hod', { schoolId: SCHOOL })]);
    const decision = authorize(
      actor,
      'read',
      resourceOf('learner', { schoolId: OTHER_SCHOOL }),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.reason).toBe('scope_not_satisfied');
  });
});

describe('OWN_SUBJECT', () => {
  it('reaches a resource matching the granted subject', () => {
    const actor = actorWith([grantOf('teacher', { subjectId: SUBJECT })]);
    expect(
      authorize(actor, 'read', resourceOf('lesson_plan', { subjectId: SUBJECT })).allowed,
    ).toBe(true);
  });

  it('also reaches a resource matching the granted class, across subjects', () => {
    // A teacher assigned to a class rather than a subject still owns the plans for that
    // class. Both routes are intended; asserting only the subject route would let the
    // class route rot unnoticed.
    const actor = actorWith([
      grantOf('teacher', { subjectId: null, classGroupId: CLASS }),
    ]);
    const decision = authorize(
      actor,
      'read',
      resourceOf('lesson_plan', { subjectId: OTHER_SUBJECT, classGroupId: CLASS }),
    );
    expect(decision.allowed).toBe(true);
  });

  it('refuses when neither the subject nor the class matches', () => {
    const actor = actorWith([grantOf('teacher')]);
    const decision = authorize(
      actor,
      'read',
      resourceOf('lesson_plan', {
        subjectId: OTHER_SUBJECT,
        classGroupId: OTHER_CLASS,
      }),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.reason).toBe('scope_not_satisfied');
  });
});

describe('OWN_CLASS', () => {
  it('refuses a grant that names no class at all', () => {
    // Unlike OWN_SCHOOL, a null class is a denial rather than a widening. A class-scoped
    // role with no class attached reaches nothing, because the alternative reading —
    // "every class" — would hand a teacher the whole school by omission.
    const actor = actorWith([grantOf('teacher', { classGroupId: null })]);
    const decision = authorize(actor, 'read', resourceOf('learner'));
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.reason).toBe('scope_not_satisfied');
  });

  it('refuses another class', () => {
    const actor = actorWith([grantOf('teacher', { classGroupId: CLASS })]);
    const decision = authorize(
      actor,
      'read',
      resourceOf('learner', { classGroupId: OTHER_CLASS }),
    );
    expect(decision.allowed).toBe(false);
  });
});

describe('OWN, for a learner rather than a guardian', () => {
  it('lets a learner read their own record', () => {
    const actor = actorWith([grantOf('learner')]);
    expect(
      authorize(actor, 'read', resourceOf('learner', { ownerId: USER })).allowed,
    ).toBe(true);
  });

  it('does not let a learner read another learner`s record', () => {
    const actor = actorWith([grantOf('learner')]);
    const decision = authorize(
      actor,
      'read',
      resourceOf('learner', { ownerId: OTHER_USER }),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.reason).toBe('not_own_record');
  });

  it('applies the same ownership rule to a role that is neither guardian nor learner', () => {
    // `teacher` holds teaching_analytics at OWN scope — developmental data about their own
    // practice. The fallthrough branch is what keeps that to their own row.
    const actor = actorWith([grantOf('teacher')]);
    expect(
      authorize(actor, 'read', resourceOf('teaching_analytics', { ownerId: USER }))
        .allowed,
    ).toBe(true);
    const denied = authorize(
      actor,
      'read',
      resourceOf('teaching_analytics', { ownerId: OTHER_USER }),
    );
    expect(denied.allowed).toBe(false);
    expect(denied.allowed === false && denied.reason).toBe('not_own_record');
  });

  it('refuses a guardian whose resource names no learner', () => {
    const actor = actorWith([grantOf('guardian')], {
      guardianOfLearnerIds: [LEARNER],
    });
    const decision = authorize(actor, 'read', resourceOf('learner', { learnerId: null }));
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.reason).toBe('not_guardian_of_learner');
  });
});

describe('assertAuthorized', () => {
  it('returns quietly when the action is allowed', () => {
    const actor = actorWith([grantOf('admin')]);
    expect(() =>
      assertAuthorized(actor, 'read', resourceOf('tenant_setting')),
    ).not.toThrow();
  });

  it('throws an AuthorizationError carrying the reason', () => {
    // The reason is on the error rather than only in the message, so a caller can branch
    // on it without parsing prose. Nothing was exercising this at all until now — the
    // throwing entry point most call sites will reach for had zero coverage.
    const actor = actorWith([grantOf('teacher')]);
    let thrown: unknown;
    try {
      assertAuthorized(actor, 'read', resourceOf('tenant_setting'));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(AuthorizationError);
    expect((thrown as AuthorizationError).reason).toBe('no_matching_permission');
    expect((thrown as AuthorizationError).name).toBe('AuthorizationError');
    expect((thrown as AuthorizationError).message).toContain('no_matching_permission');
  });

  it('reports an expired grant as expired, not as missing', () => {
    // The two lead an administrator to entirely different fixes: renew the appointment,
    // or grant a role that was never held.
    const actor = actorWith([
      grantOf('admin', { expiresAt: new Date('2026-01-01T00:00:00.000Z') }),
    ]);
    let thrown: unknown;
    try {
      assertAuthorized(
        actor,
        'read',
        resourceOf('tenant_setting'),
        new Date('2026-06-01T00:00:00.000Z'),
      );
    } catch (error) {
      thrown = error;
    }
    expect((thrown as AuthorizationError).reason).toBe('grant_expired');
  });
});
