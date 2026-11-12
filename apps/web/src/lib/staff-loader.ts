// The staff overview for `/admin/staff`.
//
// Rule 5: the read goes through `withTenant`, with the tenant and actor taken from the verified
// session. Unlike the header's school name this does not swallow a fault: an administrator looking at
// a page that quietly shows "no staff" because the database failed would draw the wrong conclusion
// about who can sign in. A fault propagates and the page's error boundary says so.

import { loadStaffOverview, withTenant, type StaffOverview } from '@infinite-ai/db';

export interface StaffScope {
  readonly tenantId: string;
  readonly actorId: string;
}

export const EMPTY_STAFF_OVERVIEW: StaffOverview = {
  schools: [],
  accounts: [],
  invitations: [],
  grantRequests: [],
  truncated: false,
};

/** Nothing is read without both a tenant and an account: the page shows an empty overview instead. */
export async function loadStaff(
  scope: StaffScope,
  now: Date = new Date(),
): Promise<StaffOverview> {
  if (scope.tenantId === '' || scope.actorId === '') return EMPTY_STAFF_OVERVIEW;
  return withTenant({ tenantId: scope.tenantId, actorId: scope.actorId }, (tx) =>
    loadStaffOverview(tx, now),
  );
}
