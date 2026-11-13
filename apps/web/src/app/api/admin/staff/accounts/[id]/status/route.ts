// POST /api/admin/staff/accounts/[id]/status — an administrator suspends or offboards an account
// (OQ-033 step 5, slice d).
//
// Either way the account stops resolving at sign-in and, because a gate decision re-checks the account
// (Stage 125), stops being able to decide. Offboarding is final: it also ends every live role and the
// account cannot be changed again. A suspended account comes back through `/reinstate` (OQ-047), never
// through this body, so the contract names only the two ways out. The rules refuse a
// non-administrator and changing your own status; the last administrator cannot be affected, because the
// actor must be a different administrator. Tenant and actor from the verified token only.

import { setAccountStatus, withTenant } from '@infinite-ai/db';
import { NextResponse, type NextRequest } from 'next/server';

import { syncIdentityProvider } from '@/lib/idp/sync';
import { provisioningRules } from '@/lib/provisioning-rules';
import { IdParam, SetStatusBody } from '@/lib/staff-contract';
import { readAdminCaller, readJsonBody, refusalResponse } from '@/lib/staff-route';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const caller = await readAdminCaller(request);
  if (!caller.ok) return caller.response;
  const id = IdParam.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const body = await readJsonBody(request, SetStatusBody);
  if (!body.ok) return body.response;

  const { tenantId, actorId } = caller.actor;
  const result = await withTenant({ tenantId, actorId }, (tx) =>
    setAccountStatus(tx, provisioningRules, {
      actorAccountId: actorId,
      targetAccountId: id.data,
      status: body.data.status,
      now: new Date(),
    }),
  );
  if (!result.ok) return refusalResponse(result.reason);
  await syncIdentityProvider(caller.actor);
  return NextResponse.json({ done: true }, { status: 200 });
}
