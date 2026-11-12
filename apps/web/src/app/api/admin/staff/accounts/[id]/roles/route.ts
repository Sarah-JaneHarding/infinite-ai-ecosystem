// POST /api/admin/staff/accounts/[id]/roles — an administrator gives an existing account roles
// (OQ-033 step 5, slice c).
//
// Two paths, chosen by the roles and never by the caller: `admin` and `smt` are authority over other
// people and gates, so they are only ever *proposed* (`requestRoleGrant`: stored for a second
// administrator to confirm, or applied with an audited waiver when the school has just one); every
// other staff role is granted directly (`grantRole`). A request mixing the two is refused rather than
// half-applied. Tenant and actor from the verified token only; acting as `admin` is required.

import {
  defaultRoleGrantExpiry,
  grantRole,
  requestRoleGrant,
  SENSITIVE_ROLES,
  withTenant,
} from '@infinite-ai/db';
import { NextResponse, type NextRequest } from 'next/server';

import { provisioningRules } from '@/lib/provisioning-rules';
import { GrantRolesBody, IdParam } from '@/lib/staff-contract';
import { readAdminCaller, readJsonBody, refusalResponse } from '@/lib/staff-route';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const caller = await readAdminCaller(request);
  if (!caller.ok) return caller.response;
  const id = IdParam.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const body = await readJsonBody(request, GrantRolesBody);
  if (!body.ok) return body.response;

  const sensitive = SENSITIVE_ROLES as readonly string[];
  const needsSecondAdmin = body.data.roles.filter((r) => sensitive.includes(r));
  if (needsSecondAdmin.length > 0 && needsSecondAdmin.length < body.data.roles.length) {
    return refusalResponse('mixed_roles');
  }

  const { tenantId, actorId } = caller.actor;
  const now = new Date();
  if (needsSecondAdmin.length === 0) {
    const result = await withTenant({ tenantId, actorId }, (tx) =>
      grantRole(tx, provisioningRules, {
        actorAccountId: actorId,
        targetAccountId: id.data,
        roles: body.data.roles,
        now,
      }),
    );
    if (!result.ok) return refusalResponse(result.reason);
    return NextResponse.json({ outcome: 'granted' }, { status: 200 });
  }

  const result = await withTenant({ tenantId, actorId }, (tx) =>
    requestRoleGrant(tx, provisioningRules, {
      actorAccountId: actorId,
      targetAccountId: id.data,
      roles: body.data.roles,
      expiresAt: defaultRoleGrantExpiry(now),
      now,
    }),
  );
  if (!result.ok) return refusalResponse(result.reason);
  return NextResponse.json({ outcome: result.outcome }, { status: 200 });
}
