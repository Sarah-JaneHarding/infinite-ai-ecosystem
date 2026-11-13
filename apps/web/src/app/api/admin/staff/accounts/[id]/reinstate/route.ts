// POST /api/admin/staff/accounts/[id]/reinstate — an administrator brings a SUSPENDED account back
// (OQ-047). No body: there is one thing this route does.
//
// Only SUSPENDED goes back to ACTIVE. An OFFBOARDED account stays final — offboarding ended its roles, and
// restoring a person is a fresh invitation, not an undo. Reinstating changes no role: what the person held
// when suspended is what they hold again, so it grants nothing a second administrator has not already seen.
// The same rules gate it as suspending (a different, active administrator; never yourself). Tenant and actor
// from the verified token only.

import { reinstateAccount, withTenant } from '@infinite-ai/db';
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
    reinstateAccount(tx, provisioningRules, {
      actorAccountId: actorId,
      targetAccountId: id.data,
      now: new Date(),
    }),
  );
  if (!result.ok) return refusalResponse(result.reason);
  await syncIdentityProvider(caller.actor);
  return NextResponse.json({ done: true }, { status: 200 });
}
