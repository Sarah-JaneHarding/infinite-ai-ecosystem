// POST /api/admin/staff/accounts/[id]/roles/revoke — an administrator ends one of an account's roles
// (OQ-033 step 5, slice c). The assignments are expired as of now, not deleted, so who held what stays
// readable. The rules refuse a non-administrator and changing your own roles; the last administrator
// cannot be removed (the actor must be a different administrator). Tenant and actor from the token only.

import { revokeRole, withTenant } from '@infinite-ai/db';
import { NextResponse, type NextRequest } from 'next/server';

import { syncIdentityProvider } from '@/lib/idp/sync';
import { provisioningRules } from '@/lib/provisioning-rules';
import { IdParam, RevokeRoleBody } from '@/lib/staff-contract';
import { readAdminCaller, readJsonBody, refusalResponse } from '@/lib/staff-route';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const caller = await readAdminCaller(request);
  if (!caller.ok) return caller.response;
  const id = IdParam.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const body = await readJsonBody(request, RevokeRoleBody);
  if (!body.ok) return body.response;

  const { tenantId, actorId } = caller.actor;
  const result = await withTenant({ tenantId, actorId }, (tx) =>
    revokeRole(tx, provisioningRules, {
      actorAccountId: actorId,
      targetAccountId: id.data,
      role: body.data.role,
      now: new Date(),
    }),
  );
  if (!result.ok) return refusalResponse(result.reason);
  await syncIdentityProvider(caller.actor);
  return NextResponse.json({ done: true }, { status: 200 });
}
