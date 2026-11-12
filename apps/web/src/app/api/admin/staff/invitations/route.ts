// POST /api/admin/staff/invitations — an administrator invites a person (OQ-033 step 5, slice b).
//
// The tenant and the actor come from the verified session token, never from the request (rule 5);
// the request names only an address and roles. Who may confer which roles is not decided here: the
// provisioning rules (`@infinite-ai/policy`, bound in `lib/provisioning-rules.ts`) decide inside the
// transaction, under the school's provisioning lock, and the invitation and its audit event commit
// together. The request must be acting as `admin` (the proxy enforces the route; this re-checks).

import { createInvitation, defaultInvitationExpiry, withTenant } from '@infinite-ai/db';
import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';

import { getWebEnv } from '@/lib/env';
import { provisioningRules } from '@/lib/provisioning-rules';
import { InviteStaffBody, refusalFor } from '@/lib/staff-contract';
import { readTokenActingAs, readTokenActor } from '@/lib/token-actor';

export async function POST(request: NextRequest): Promise<NextResponse> {
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

  // A cross-site form cannot send JSON, so requiring it closes the simplest forged-request route.
  if (
    !(request.headers.get('content-type') ?? '')
      .toLowerCase()
      .startsWith('application/json')
  ) {
    return NextResponse.json({ error: 'Expected application/json' }, { status: 415 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = InviteStaffBody.safeParse(body);
  if (!parsed.success) {
    // Field paths only: the issues' messages can quote what was sent.
    return NextResponse.json(
      { error: 'Bad request', fields: parsed.error.issues.map((i) => i.path.join('.')) },
      { status: 400 },
    );
  }

  const { tenantId, actorId } = caller.actor;
  const now = new Date();
  const result = await withTenant({ tenantId, actorId }, (tx) =>
    createInvitation(tx, provisioningRules, {
      actorAccountId: actorId,
      email: parsed.data.email,
      roles: parsed.data.roles,
      expiresAt: defaultInvitationExpiry(now),
      now,
    }),
  );

  if (!result.ok) {
    const refusal = refusalFor(result.reason);
    return NextResponse.json({ error: refusal.message }, { status: refusal.status });
  }
  return NextResponse.json(
    { invitationId: result.invitationId, confirmation: result.confirmation },
    { status: 201 },
  );
}
