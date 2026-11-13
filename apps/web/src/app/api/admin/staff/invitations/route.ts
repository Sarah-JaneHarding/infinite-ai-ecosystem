// POST /api/admin/staff/invitations — an administrator invites a person (OQ-033 step 5, slice b).
//
// The tenant and the actor come from the verified session token, never from the request (rule 5);
// the request names only an address and roles. Who may confer which roles is not decided here: the
// provisioning rules (`@infinite-ai/policy`, bound in `lib/provisioning-rules.ts`) decide inside the
// transaction, under the school's provisioning lock, and the invitation and its audit event commit
// together. `readAdminCaller` also requires the session to be acting as `admin`.

import {
  createInvitation,
  defaultInvitationExpiry,
  requestInvitationIdpSync,
  withTenant,
} from '@infinite-ai/db';
import { NextResponse, type NextRequest } from 'next/server';

import { isIdentityProviderConfigured } from '@/lib/idp/provider';
import { syncIdentityProvider } from '@/lib/idp/sync';
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
  // Opt the invitation in only when an identity provider is connected, and in the SAME transaction as the
  // invitation: it either exists as something Keycloak must hear about or as the by-hand kind, never both.
  const managed = isIdentityProviderConfigured();
  const result = await withTenant({ tenantId, actorId }, async (tx) => {
    const created = await createInvitation(tx, provisioningRules, {
      actorAccountId: actorId,
      email: body.data.email,
      roles: body.data.roles,
      ...(body.data.schoolId === undefined ? {} : { schoolId: body.data.schoolId }),
      expiresAt: defaultInvitationExpiry(now),
      now,
    });
    if (created.ok && managed) await requestInvitationIdpSync(tx, created.invitationId);
    return created;
  });
  if (!result.ok) return refusalResponse(result.reason);
  await syncIdentityProvider(caller.actor);
  return NextResponse.json(
    { invitationId: result.invitationId, confirmation: result.confirmation },
    { status: 201 },
  );
}
