// Whether an actor currently holds a role — Stage 06 step 5.
//
// `packages/policy/src/rbac.ts`'s `authorize()` decides a *data-access* question (can this
// actor, holding these grants, touch this resource for this purpose) and takes an already-
// built `Actor` with its `grants` attached; nothing in this codebase queries
// `role_assignment` on its own to answer the narrower question a `human_gate` step actually
// asks — "does this actor hold this one named role, right now" — so this module adds it
// rather than routing a workflow gate through machinery built for POPIA purpose limitation.
//
// "Right now" means active: `expiresAt` null, or in the future relative to the caller's own
// `now` (never the database's clock), the same time-boxing `role_assignment.expiresAt`'s own
// schema comment already describes for support impersonation.

import type { TenantClient } from './client.js';

/** Whether `userAccountId` holds an unexpired `role_assignment` row for `role`, in the
 * tenant already active on `tx`. Scope (school/class/subject) is irrelevant here: a
 * `human_gate`'s `requiredRole` names a role, not a resource this codebase would know how
 * to scope a workflow decision to. */
export async function hasActiveRoleAssignment(
  tx: TenantClient,
  userAccountId: string,
  role: string,
  now: Date,
): Promise<boolean> {
  const match = await tx.roleAssignment.findFirst({
    where: {
      userAccountId,
      role,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true },
  });
  return match !== null;
}

/**
 * The distinct roles `userAccountId` holds right now: its unexpired `role_assignment` rows, in the
 * tenant already active on `tx`. Sorted, so the answer has no order that could be mistaken for a
 * precedence (OQ-032: nothing ranks one role above another).
 *
 * The sign-in intersects this with the provider's claim to decide which roles a session may act as
 * (docs/PROVISIONING_DESIGN.md §4.4, §4.8). Scope is irrelevant here for the same reason it is in
 * `hasActiveRoleAssignment`: the question is which roles, not where they apply.
 */
export async function listActiveRoles(
  tx: TenantClient,
  userAccountId: string,
  now: Date,
): Promise<string[]> {
  const rows = await tx.roleAssignment.findMany({
    where: {
      userAccountId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { role: true },
  });
  return [...new Set(rows.map((r) => r.role))].sort();
}
