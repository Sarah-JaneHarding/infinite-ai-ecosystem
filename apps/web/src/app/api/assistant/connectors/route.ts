// GET /api/assistant/connectors — which assistants this school can use right now.

import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

import { listAvailableAssistants } from '@/lib/assistant-chat';
import { assistantDeps } from '@/lib/assistant-runtime';
import { getWebEnv } from '@/lib/env';
import { roleMayReach } from '@/lib/route-access';
import { readTokenActingAs, readTokenActor } from '@/lib/token-actor';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request, secret: getWebEnv().NEXTAUTH_SECRET });
  const caller = readTokenActor(token);
  if (!caller.ok) {
    return NextResponse.json({ error: caller.error }, { status: caller.status });
  }
  const actingAs = readTokenActingAs(token);
  if (actingAs === null || !roleMayReach(actingAs, '/api/assistant/connectors')) {
    return NextResponse.json(
      { error: 'The assistant is for school staff.' },
      { status: 403 },
    );
  }
  const { fetchImpl, gatewayBaseUrl } = assistantDeps();
  return NextResponse.json({
    assistants: await listAvailableAssistants({ fetchImpl, gatewayBaseUrl }),
  });
}
