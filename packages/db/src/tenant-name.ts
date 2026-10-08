// The current tenant's display name, for the shell header.
//
// `tenant` is self-keyed: its RLS policy compares `id` to `app.tenant_id`, so inside
// `withTenant` the only row this can see is the caller's own school. There is no id
// argument to get wrong — which is the point: a name for any other tenant cannot be asked for.

import type { TenantClient } from './client.js';

/** The calling tenant's name, or `null` if its row is gone or the name is blank. */
export async function readTenantName(tx: TenantClient): Promise<string | null> {
  const row = await tx.tenant.findFirst({ select: { name: true } });
  const name = row?.name.trim() ?? '';
  return name === '' ? null : name;
}
