// Whether the current tenant is ACTIVE, for sign-in (docs/PROVISIONING_DESIGN.md §4.3 step 1).
//
// `tenant` is self-keyed — its RLS policy compares `id` to `app.tenant_id` — so inside `withTenant`
// the only row this can see is the caller's own school. There is no id argument to get wrong.
// A SUSPENDED or CLOSED school resolves no actor, so nobody signs in to act for it; a context with
// no tenant row at all is not active either.

import type { TenantClient } from './client.js';

export async function isTenantActive(tx: TenantClient): Promise<boolean> {
  const row = await tx.tenant.findFirst({
    where: { status: 'ACTIVE' },
    select: { id: true },
  });
  return row !== null;
}
