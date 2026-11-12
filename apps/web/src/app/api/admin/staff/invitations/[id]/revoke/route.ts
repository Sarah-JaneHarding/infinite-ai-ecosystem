// POST /api/admin/staff/invitations/[id]/revoke — an administrator withdraws a pending invitation
// (OQ-033 step 5, slice b). Tenant and actor from the verified token only, acting as `admin`; the data
// layer re-checks the actor is an active administrator under the provisioning lock and audits it.

import { revokeInvitation, withTenant } from '@infinite-ai/db';
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
    revokeInvitation(tx, {
      actorAccountId: actorId,
      invitationId: id.data,
      now: new Date(),
    }),
  );
  if (!result.ok) return refusalResponse(result.reason);
  return NextResponse.json({ revoked: true }, { status: 200 });
}
