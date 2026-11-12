// POST /api/admin/staff/invitations/[id]/confirm — the second administrator confirms an invitation that
// carries `admin` or `smt` (OQ-033 step 5, slice c). As themselves, in their own authenticated request:
// the data layer re-applies the rules against today's administrators, so the proposer cannot confirm
// their own invitation and a confirmer who is no longer an administrator is refused.

import { confirmInvitation, withTenant } from '@infinite-ai/db';
import { NextResponse, type NextRequest } from 'next/server';

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
    confirmInvitation(tx, provisioningRules, {
      confirmerAccountId: actorId,
      invitationId: id.data,
      now: new Date(),
    }),
  );
  if (!result.ok) return refusalResponse(result.reason);
  return NextResponse.json({ done: true }, { status: 200 });
}
