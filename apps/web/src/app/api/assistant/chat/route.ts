// POST /api/assistant/chat — one turn with one of the connected AI assistants.
//
// Staff only. Tenant and actor come from the verified session token and nothing else: the body
// contract is strict, so a `tenantId` or `model` in it is a 400, not an override. The text is
// scrubbed and audited in `runAssistantChat`; this handler only checks who is asking.

import { AssistantChatRequest } from '@infinite-ai/contracts';
import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

import { AssistantChatError, runAssistantChat } from '@/lib/assistant-chat';
import { assistantDeps } from '@/lib/assistant-runtime';
import { getWebEnv } from '@/lib/env';
import { roleMayReach } from '@/lib/route-access';
import { readJsonBody } from '@/lib/staff-route';
import { readTokenActingAs, readTokenActor } from '@/lib/token-actor';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request, secret: getWebEnv().NEXTAUTH_SECRET });
  const caller = readTokenActor(token);
  if (!caller.ok) {
    return NextResponse.json({ error: caller.error }, { status: caller.status });
  }
  // Defence in depth: the proxy already enforces this table, so does the handler (a test pins
  // the two together). A learner, guardian or platform role is refused here too.
  const actingAs = readTokenActingAs(token);
  if (actingAs === null || !roleMayReach(actingAs, '/api/assistant/chat')) {
    return NextResponse.json(
      { error: 'The assistant is for school staff.' },
      { status: 403 },
    );
  }

  const body = await readJsonBody(request, AssistantChatRequest);
  if (!body.ok) return body.response;

  try {
    const result = await runAssistantChat(
      { ...caller.actor, request: body.data },
      assistantDeps(),
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AssistantChatError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    // Anything else is a bug or an outage we cannot describe safely: no detail leaves.
    return NextResponse.json({ error: 'The assistant is unavailable.' }, { status: 500 });
  }
}
