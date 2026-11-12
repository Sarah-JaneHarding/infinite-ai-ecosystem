// POST /api/admin/staff/invitations/[id]/revoke — an administrator withdraws a pending invitation
// (OQ-033 step 5, slice b). Same rules as the invite route: tenant and actor from the verified token
// only, acting as `admin`, and the data layer re-checks that the actor is an active administrator
// under the provisioning lock and audits the revocation in the same transaction.

import { revokeInvitation, withTenant } from '@infinite-ai/db';
import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';

import { getWebEnv } from '@/lib/env';
import { InvitationIdParam, refusalFor } from '@/lib/staff-contract';
import { readTokenActingAs, readTokenActor } from '@/lib/token-actor';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const token = await getToken({ req: request, secret: getWebEnv().NEXTAUTH_SECRET });

  const caller = readTokenActor(token);
  if (!caller.ok) {
    return NextResponse.json({ error: caller.error }, { status: caller.status });
  }
  if (readTokenActingAs(token) !== 'admin') {
    return NextResponse.json(
      { error: 'Sign in acting as an administrator.' },
      { status: 403 },
    );
  }

  const id = InvitationIdParam.safeParse((await params).id);
  if (!id.success) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const { tenantId, actorId } = caller.actor;
  const result = await withTenant({ tenantId, actorId }, (tx) =>
    revokeInvitation(tx, {
      actorAccountId: actorId,
      invitationId: id.data,
      now: new Date(),
    }),
  );
  if (!result.ok) {
    const refusal = refusalFor(result.reason);
    return NextResponse.json({ error: refusal.message }, { status: refusal.status });
  }
  return NextResponse.json({ revoked: true }, { status: 200 });
}
