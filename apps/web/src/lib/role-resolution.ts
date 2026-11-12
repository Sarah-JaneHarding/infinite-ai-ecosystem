// Reading the school's side of the eligibility rule (see eligible-roles.ts): which roles the
// person's account holds right now. Rule 5 — through `withTenant`, tenant from the verified
// sign-in. No account (`''`) holds nothing; a database fault is not swallowed, so sign-in fails
// and can be retried rather than issuing a session with a silently shorter role list.

import { InvalidTenantContextError, listActiveRoles, withTenant } from '@infinite-ai/db';
import type { Role } from '@infinite-ai/policy';

import { eligibleRoles, type EligibleRoles } from './eligible-roles';
import { readRole } from './session-role';

export async function resolveEligibleRoles(input: {
  readonly tenantId: string;
  readonly accountId: string;
  readonly claimRoles: readonly Role[];
  readonly now?: Date;
}): Promise<EligibleRoles> {
  const { tenantId, accountId, claimRoles } = input;
  let assignedRoles: Role[] = [];
  if (tenantId !== '' && accountId !== '') {
    try {
      const rows = await withTenant({ tenantId, actorId: accountId }, (tx) =>
        listActiveRoles(tx, accountId, input.now ?? new Date()),
      );
      assignedRoles = rows.map(readRole).filter((r): r is Role => r !== null);
    } catch (error) {
      if (!(error instanceof InvalidTenantContextError)) throw error;
    }
  }
  return eligibleRoles({ claimRoles, assignedRoles });
}
