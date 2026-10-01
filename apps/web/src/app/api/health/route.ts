// GET /api/health — liveness for the container healthcheck (infra/docker/compose.apps.yml).
//
// Deliberately public (see PUBLIC in src/proxy.ts) and deliberately dumb: it answers a
// constant, reads no session, no database, no tenant data and no environment. Anything
// richer would have to be authenticated and would turn a liveness probe into a data path.
// Before this route existed the healthcheck hit /api/health, which the auth proxy answered
// with a 307 redirect to sign-in — a response `curl -sf` counts as success, so the check
// passed whatever state the app was in.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET(): NextResponse {
  return NextResponse.json(
    { status: 'ok' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
