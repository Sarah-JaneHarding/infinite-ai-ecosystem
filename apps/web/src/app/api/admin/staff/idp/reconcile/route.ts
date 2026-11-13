// POST /api/admin/staff/idp/reconcile — an administrator asks the application to catch the identity
// provider up now (OQ-033 step 7d). No body. This is the retry for whatever failed or was interrupted:
// the work is read from the database again, so running it twice does no harm. Tenant and actor from the
// verified token only; it can only ever act on the caller's own school.

import { NextResponse, type NextRequest } from 'next/server';

import { isIdentityProviderConfigured } from '@/lib/idp/provider';
import { syncIdentityProvider } from '@/lib/idp/sync';
import { readAdminCaller } from '@/lib/staff-route';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const caller = await readAdminCaller(request);
  if (!caller.ok) return caller.response;
  if (!isIdentityProviderConfigured()) {
    return NextResponse.json(
      { error: 'The identity provider is not connected for this deployment.' },
      { status: 409 },
    );
  }
  const result = await syncIdentityProvider(caller.actor);
  if (result === null) {
    return NextResponse.json(
      { error: 'Could not reach the identity provider records. Try again shortly.' },
      { status: 503 },
    );
  }
  return NextResponse.json(result, { status: 200 });
}
