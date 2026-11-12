// POST /api/admin/staff/invitations — an administrator invites a person (OQ-033 step 5, slice b).
//
// The tenant and the actor come from the verified session token, never from the request (rule 5);
// the request names only an address and roles. Who may confer which roles is not decided here: the
// provisioning rules (`@infinite-ai/policy`, bound in `lib/provisioning-rules.ts`) decide inside the
// transaction, under the school's provisioning lock, and the invitation and its audit event commit
// together. `readAdminCaller` also requires the session to be acting as `admin`.

import { createInvitation, defaultInvitationExpiry, withTenant } from '@infinite-ai/db';
import { NextResponse, type NextRequest } from 'next/server';

import { provisioningRules } from '@/lib/provisioning-rules';
import { InviteStaffBody } from '@/lib/staff-contract';
import { readAdminCaller, readJsonBody, refusalResponse } from '@/lib/staff-route';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const caller = await readAdminCaller(request);
  if (!caller.ok) return caller.response;
  const body = await readJsonBody(request, InviteStaffBody);
  if (!body.ok) return body.response;

  const { tenantId, actorId } = caller.actor;
  const now = new Date();
  const result = await withTenant({ tenantId, actorId }, (tx) =>
    createInvitation(tx, provisioningRules, {
      actorAccountId: actorId,
      email: body.data.email,
      roles: body.data.roles,
      expiresAt: defaultInvitationExpiry(now),
      now,
    }),
  );
  if (!result.ok) return refusalResponse(result.reason);
  return NextResponse.json(
    { invitationId: result.invitationId, confirmation: result.confirmation },
    { status: 201 },
  );
}
