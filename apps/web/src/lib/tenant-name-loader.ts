// The school name shown in the shell header.
//
// Rule 5: the read goes through `withTenant`, with the tenant and actor taken from the
// verified session. The header is on every page, so a failed lookup must not take the whole
// shell down: it falls back to the product name. It never falls back to the tenant id —
// an opaque UUID tells a teacher nothing and is not theirs to read off a screen.

import { readTenantName, withTenant } from '@infinite-ai/db';

export const FALLBACK_TENANT_LABEL = 'Infinite AI';

export interface TenantLabelScope {
  readonly tenantId: string;
  readonly actorId: string;
}

export async function loadTenantLabel(scope: TenantLabelScope): Promise<string> {
  if (scope.tenantId === '' || scope.actorId === '') return FALLBACK_TENANT_LABEL;

  try {
    const name = await withTenant(
      { tenantId: scope.tenantId, actorId: scope.actorId },
      (tx) => readTenantName(tx),
    );
    return name ?? FALLBACK_TENANT_LABEL;
  } catch {
    // Not silent in effect: the header reads "Infinite AI" and every page's own reads
    // surface a real database fault. A name is not worth a blank shell.
    return FALLBACK_TENANT_LABEL;
  }
}
