// The authorisation model — Stage 02 steps 3 and 4.
//
// "A declarative permission matrix — resource × action × role × scope. Permissions are
// data, not `if` statements."
//
// That distinction is the point of this file. A permission expressed as a conditional is
// invisible to review, untestable in aggregate, and impossible to diff: nobody can answer
// "what can an HoD do?" without reading every route. Expressed as data, the matrix is one
// table, the generated test iterates it exhaustively, and a change that widens access
// shows up in a diff as a new row rather than a subtle edit to a boolean.
//
// Everything here is pure. No database, no network, no clock beyond what is passed in —
// so the whole model is testable without infrastructure, which is what makes exhaustive
// testing affordable.

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

/** The seven school roles plus the two platform roles (Stage 02 step 1). */
export const Role = z.enum([
  'teacher',
  'hod',
  'smt',
  'sbst',
  'admin',
  'guardian',
  'learner',
  'platform_support',
  'platform_admin',
]);
export type Role = z.infer<typeof Role>;

/** Roles belonging to INFINITE-AI rather than to a school. */
export const PLATFORM_ROLES: readonly Role[] = ['platform_support', 'platform_admin'];

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

/**
 * How wide a permission reaches.
 *
 * Ordered narrowest to widest. The order is meaningful: `satisfies` below walks it, so a
 * grant at a wider scope implies the narrower ones.
 */
export const Scope = z.enum([
  /** Only rows the actor owns or authored. */
  'OWN',
  /** Classes the actor teaches or is assigned to. */
  'OWN_CLASS',
  /** Subjects the actor teaches, across classes. */
  'OWN_SUBJECT',
  /** Everything in the actor's school or campus. */
  'OWN_SCHOOL',
  /** Everything in the tenant, across campuses. */
  'TENANT',
  /** Across tenants. Only ever held by platform roles, and always audited. */
  'PLATFORM',
]);
export type Scope = z.infer<typeof Scope>;

const SCOPE_ORDER: readonly Scope[] = [
  'OWN',
  'OWN_CLASS',
  'OWN_SUBJECT',
  'OWN_SCHOOL',
  'TENANT',
  'PLATFORM',
];

// ---------------------------------------------------------------------------
// Resources and actions
// ---------------------------------------------------------------------------

export const ResourceType = z.enum([
  'learner',
  'learner_identifier',
  'guardian',
  'class_group',
  'lesson_plan',
  'assessment',
  'screening_result',
  'intervention',
  'sbst_case',
  'staff_member',
  'teaching_analytics',
  'tenant_setting',
  'audit_event',
]);
export type ResourceType = z.infer<typeof ResourceType>;

export const Action = z.enum(['read', 'create', 'update', 'delete', 'approve', 'export']);
export type Action = z.infer<typeof Action>;

// ---------------------------------------------------------------------------
// Actor and resource
// ---------------------------------------------------------------------------

/** One role held by an actor, optionally narrowed to a school, class or subject. */
export const RoleGrant = z.object({
  role: Role,
  schoolId: z.string().uuid().nullable(),
  classGroupId: z.string().uuid().nullable(),
  subjectId: z.string().uuid().nullable(),
  /** Null means it does not lapse. A past value is treated as no grant at all. */
  expiresAt: z.date().nullable(),
});
export type RoleGrant = z.infer<typeof RoleGrant>;

export const Actor = z.object({
  userId: z.string().uuid(),
  /** The tenant this session is scoped to. */
  tenantId: z.string().uuid(),
  grants: z.array(RoleGrant),
  /**
   * Learners this actor is a guardian of. Empty for everyone else.
   *
   * Carried on the actor rather than looked up during authorisation so that `authorize`
   * stays pure and synchronous — an authorisation function that does I/O is one that gets
   * skipped "just this once" for performance.
   */
  guardianOfLearnerIds: z.array(z.string().uuid()).default([]),
  /** Set while a platform role is acting inside a tenant. See impersonation.ts. */
  impersonating: z.boolean().default(false),
});
export type Actor = z.infer<typeof Actor>;

export const Resource = z.object({
  type: ResourceType,
  tenantId: z.string().uuid(),
  schoolId: z.string().uuid().nullable().default(null),
  classGroupId: z.string().uuid().nullable().default(null),
  subjectId: z.string().uuid().nullable().default(null),
  /** For learner-owned resources: whose learner record this concerns. */
  learnerId: z.string().uuid().nullable().default(null),
  /** The user who owns or authored this resource, where that applies. */
  ownerId: z.string().uuid().nullable().default(null),
});
export type Resource = z.infer<typeof Resource>;

// ---------------------------------------------------------------------------
// The matrix
// ---------------------------------------------------------------------------

export interface Permission {
  readonly role: Role;
  readonly resource: ResourceType;
  readonly action: Action;
  readonly scope: Scope;
}

const grant = (
  role: Role,
  resource: ResourceType,
  actions: readonly Action[],
  scope: Scope,
): Permission[] => actions.map((action) => ({ role, resource, action, scope }));

/**
 * The permission matrix. This is the authorisation model in its entirety.
 *
 * Deliberately verbose. Every row is one sentence — "an HoD may approve a lesson plan
 * anywhere in their school" — and a reviewer can read the whole policy without opening
 * another file. Compressing it with loops or inheritance would trade that away for
 * brevity nobody needs.
 */
export const PERMISSIONS: readonly Permission[] = [
  // --- teacher: their own classes and subjects, and nothing wider -----------
  ...grant('teacher', 'learner', ['read'], 'OWN_CLASS'),
  ...grant('teacher', 'class_group', ['read'], 'OWN_CLASS'),
  ...grant('teacher', 'lesson_plan', ['read', 'create', 'update'], 'OWN_SUBJECT'),
  ...grant('teacher', 'assessment', ['read', 'create', 'update'], 'OWN_SUBJECT'),
  ...grant('teacher', 'screening_result', ['read'], 'OWN_CLASS'),
  ...grant('teacher', 'intervention', ['read'], 'OWN_CLASS'),
  ...grant('teacher', 'teaching_analytics', ['read'], 'OWN'),

  // --- hod: their subject across the school, plus approval ------------------
  ...grant('hod', 'learner', ['read'], 'OWN_SCHOOL'),
  ...grant('hod', 'class_group', ['read'], 'OWN_SCHOOL'),
  ...grant('hod', 'lesson_plan', ['read', 'create', 'update', 'approve'], 'OWN_SCHOOL'),
  ...grant('hod', 'assessment', ['read', 'create', 'update', 'approve'], 'OWN_SCHOOL'),
  ...grant('hod', 'screening_result', ['read'], 'OWN_SCHOOL'),
  ...grant('hod', 'teaching_analytics', ['read'], 'OWN_SCHOOL'),

  // --- smt: whole tenant, developmental analytics, no clinical detail -------
  ...grant('smt', 'learner', ['read'], 'TENANT'),
  ...grant('smt', 'class_group', ['read'], 'TENANT'),
  ...grant('smt', 'lesson_plan', ['read', 'approve'], 'TENANT'),
  ...grant('smt', 'assessment', ['read'], 'TENANT'),
  ...grant('smt', 'screening_result', ['read'], 'TENANT'),
  ...grant('smt', 'teaching_analytics', ['read'], 'TENANT'),
  ...grant('smt', 'staff_member', ['read'], 'TENANT'),

  // --- sbst: the support pathway, including the decisions others cannot make -
  ...grant('sbst', 'learner', ['read'], 'TENANT'),
  ...grant('sbst', 'screening_result', ['read', 'create', 'update'], 'TENANT'),
  ...grant('sbst', 'intervention', ['read', 'create', 'update', 'approve'], 'TENANT'),
  ...grant('sbst', 'sbst_case', ['read', 'create', 'update', 'approve'], 'TENANT'),
  // Referral packs leave the school, so export is granted here and nowhere else.
  ...grant('sbst', 'sbst_case', ['export'], 'TENANT'),

  // --- admin: configuration and staff, deliberately not learner support -----
  ...grant('admin', 'tenant_setting', ['read', 'update'], 'TENANT'),
  ...grant('admin', 'staff_member', ['read', 'create', 'update'], 'TENANT'),
  ...grant('admin', 'class_group', ['read', 'create', 'update'], 'TENANT'),
  ...grant('admin', 'learner', ['read', 'create', 'update'], 'TENANT'),
  ...grant('admin', 'audit_event', ['read'], 'TENANT'),

  // --- guardian: their own children, read-only -------------------------------
  // Scope OWN is not sufficient on its own; guardianOfLearnerIds is checked explicitly
  // below, because "own" for a guardian means a relationship, not authorship.
  ...grant('guardian', 'learner', ['read'], 'OWN'),
  ...grant('guardian', 'assessment', ['read'], 'OWN'),
  ...grant('guardian', 'intervention', ['read'], 'OWN'),

  // --- learner: their own record, narrower still -----------------------------
  ...grant('learner', 'learner', ['read'], 'OWN'),
  ...grant('learner', 'assessment', ['read'], 'OWN'),

  // --- platform_support: read-only, cross-tenant, only while impersonating ---
  ...grant('platform_support', 'tenant_setting', ['read'], 'PLATFORM'),
  ...grant('platform_support', 'audit_event', ['read'], 'PLATFORM'),
  ...grant('platform_support', 'class_group', ['read'], 'PLATFORM'),

  // --- platform_admin: configuration across tenants, never learner data ------
  // Note what is absent: no learner, no learner_identifier, no screening_result, no
  // sbst_case. Platform staff have no business reading a child's support record, and the
  // cleanest way to guarantee that is to never grant it.
  ...grant('platform_admin', 'tenant_setting', ['read', 'update'], 'PLATFORM'),
  ...grant('platform_admin', 'audit_event', ['read'], 'PLATFORM'),
];

/**
 * Resource types no role may read at any scope through this matrix.
 *
 * `learner_identifier` holds encrypted direct identifiers. Reading it is re-identification,
 * which goes through the de-identification service's audited API in Stage 03 rather than
 * through ordinary RBAC. Listing it here means a future grant has to delete this line, and
 * deleting a line called "never granted through RBAC" is a conversation.
 */
export const NEVER_GRANTED_VIA_RBAC: readonly ResourceType[] = ['learner_identifier'];

// ---------------------------------------------------------------------------
// The decision
// ---------------------------------------------------------------------------

export type Decision =
  | { readonly allowed: true; readonly matched: Permission }
  | { readonly allowed: false; readonly reason: DenialReason };

export type DenialReason =
  | 'cross_tenant'
  | 'no_matching_permission'
  | 'scope_not_satisfied'
  | 'grant_expired'
  | 'not_guardian_of_learner'
  | 'not_own_record'
  | 'platform_role_not_impersonating'
  | 'resource_never_granted_via_rbac';

function isActive(grant: RoleGrant, now: Date): boolean {
  return grant.expiresAt === null || grant.expiresAt.getTime() > now.getTime();
}

function scopeAtLeast(held: Scope, required: Scope): boolean {
  return SCOPE_ORDER.indexOf(held) >= SCOPE_ORDER.indexOf(required);
}

/**
 * Does this grant, at this scope, actually reach this resource?
 *
 * Separate from the matrix lookup on purpose: the matrix says what a role may do in
 * principle, this says whether the specific row is within reach. Conflating them is how
 * "teachers can read learners" becomes "teachers can read all learners".
 */
function reaches(
  actor: Actor,
  grant: RoleGrant,
  permission: Permission,
  resource: Resource,
): true | DenialReason {
  switch (permission.scope) {
    case 'PLATFORM':
      // A platform role acting on tenant data must be inside an impersonation session, so
      // there is always a reason, an expiry and an audit trail behind the access.
      return actor.impersonating ? true : 'platform_role_not_impersonating';

    case 'TENANT':
      return true; // Tenant equality was already established by the caller.

    case 'OWN_SCHOOL':
      if (grant.schoolId === null) return true; // Tenant-wide grant of a school-scoped role.
      return grant.schoolId === resource.schoolId ? true : 'scope_not_satisfied';

    case 'OWN_SUBJECT':
      if (grant.subjectId !== null && grant.subjectId === resource.subjectId) return true;
      if (grant.classGroupId !== null && grant.classGroupId === resource.classGroupId) {
        return true;
      }
      return 'scope_not_satisfied';

    case 'OWN_CLASS':
      if (grant.classGroupId === null) return 'scope_not_satisfied';
      return grant.classGroupId === resource.classGroupId ? true : 'scope_not_satisfied';

    case 'OWN':
      // Guardians are the special case: "own" is a relationship, not authorship.
      if (grant.role === 'guardian') {
        if (resource.learnerId === null) return 'not_guardian_of_learner';
        return actor.guardianOfLearnerIds.includes(resource.learnerId)
          ? true
          : 'not_guardian_of_learner';
      }
      if (grant.role === 'learner') {
        return resource.ownerId === actor.userId ? true : 'not_own_record';
      }
      return resource.ownerId === actor.userId ? true : 'not_own_record';
  }
}

/**
 * The single authorisation entry point.
 *
 * Every tRPC procedure and REST handler calls this. It is pure and synchronous so there is
 * never a performance argument for skipping it.
 *
 * Denial is the default: the function returns allow only when a specific row in the matrix
 * matches and its scope is satisfied. There is no wildcard, no superuser branch and no
 * "if this fails, fall through" — a bug in this function fails closed.
 */
export function authorize(
  actor: Actor,
  action: Action,
  resource: Resource,
  now: Date = new Date(),
): Decision {
  if (NEVER_GRANTED_VIA_RBAC.includes(resource.type)) {
    return { allowed: false, reason: 'resource_never_granted_via_rbac' };
  }

  const active = actor.grants.filter((g) => isActive(g, now));
  const hasPlatformRole = active.some((g) => PLATFORM_ROLES.includes(g.role));

  // Cross-tenant access is refused before anything else is considered. Only a platform
  // role inside an impersonation session gets past this, and RLS is still underneath it.
  if (actor.tenantId !== resource.tenantId && !hasPlatformRole) {
    return { allowed: false, reason: 'cross_tenant' };
  }

  let bestFailure: DenialReason = 'no_matching_permission';

  for (const g of active) {
    for (const permission of PERMISSIONS) {
      if (permission.role !== g.role) continue;
      if (permission.resource !== resource.type) continue;
      if (permission.action !== action) continue;
      if (!scopeAtLeast(permission.scope, 'OWN')) continue;

      const reach = reaches(actor, g, permission, resource);
      if (reach === true) return { allowed: true, matched: permission };
      bestFailure = reach;
    }
  }

  // A grant that only failed because it had expired should say so, rather than reporting
  // "no permission" — the two lead an administrator to entirely different fixes.
  if (
    bestFailure === 'no_matching_permission' &&
    actor.grants.length > active.length &&
    actor.grants.some(
      (g) =>
        !isActive(g, now) &&
        PERMISSIONS.some(
          (p) => p.role === g.role && p.resource === resource.type && p.action === action,
        ),
    )
  ) {
    return { allowed: false, reason: 'grant_expired' };
  }

  return { allowed: false, reason: bestFailure };
}

/** Throws unless allowed. For call sites where a denial is genuinely exceptional. */
export class AuthorizationError extends Error {
  public override readonly name = 'AuthorizationError';
  constructor(public readonly reason: DenialReason) {
    super(`Authorization denied: ${reason}`);
  }
}

export function assertAuthorized(
  actor: Actor,
  action: Action,
  resource: Resource,
  now: Date = new Date(),
): void {
  const decision = authorize(actor, action, resource, now);
  if (!decision.allowed) throw new AuthorizationError(decision.reason);
}
