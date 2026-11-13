// POST /api/admin/staff/role-requests/[id]/confirm (OQ-033 step 5, slice c).
// A different administrator confirms a pending request for `admin` or `smt`: the rules are re-applied against today's administrators, so the proposer cannot confirm their own request, and the roles are granted and the request closed in one transaction.
// Tenant and actor from the verified token only; acting as `admin` is required.

import { confirmRoleGrant, withTenant } from '@infinite-ai/db';
import { NextResponse, type NextRequest } from 'next/server';

import { syncIdentityProvider } from '@/lib/idp/sync';
import { provisioningRules } from '@/lib/provisioning-rules';
import { IdParam } from '@/lib/staff-contract';
import { readAdminCaller, refusalResponse } from '@/lib/staff-route';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const caller = await readAdminCaller(request);
  if (!caller.ok) return caller.response;
  const id = IdParam.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const { tenantId, actorId } = caller.actor;
  const result = await withTenant({ tenantId, actorId }, (tx) =>
    confirmRoleGrant(tx, provisioningRules, {
      confirmerAccountId: actorId,
      requestId: id.data,
      now: new Date(),
    }),
  );
  if (!result.ok) return refusalResponse(result.reason);
  await syncIdentityProvider(caller.actor);
  return NextResponse.json({ done: true }, { status: 200 });
}
