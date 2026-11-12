// POST /api/admin/staff/role-requests/[id]/cancel (OQ-033 step 5, slice c).
// An active administrator withdraws a pending request, the proposer included: withdrawing a proposal only narrows what could happen.
// Tenant and actor from the verified token only; acting as `admin` is required.

import { cancelRoleGrant, withTenant } from '@infinite-ai/db';
import { NextResponse, type NextRequest } from 'next/server';

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
    cancelRoleGrant(tx, {
      actorAccountId: actorId,
      requestId: id.data,
      now: new Date(),
    }),
  );
  if (!result.ok) return refusalResponse(result.reason);
  return NextResponse.json({ done: true }, { status: 200 });
}
