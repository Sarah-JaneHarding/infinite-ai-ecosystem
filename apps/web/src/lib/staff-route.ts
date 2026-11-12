// What every administrator route under /api/admin/staff does first (OQ-033 step 5), in one place so a
// route cannot forget a step: read the verified token, require a tenant and a resolved account (rule 5),
// require the session to be acting as `admin` (§4.8: an action is checked against the active role), and
// for a route with a body, require JSON and a body that satisfies its strict contract.
//
// The tenant and the actor come only from the token. Nothing here reads either from the request.

import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';
import type { z } from 'zod';

import { getWebEnv } from '@/lib/env';
import { refusalFor } from '@/lib/staff-contract';
import { readTokenActingAs, readTokenActor, type TokenActor } from '@/lib/token-actor';

export type AdminCaller =
  | { readonly ok: true; readonly actor: TokenActor }
  | { readonly ok: false; readonly response: NextResponse };

export async function readAdminCaller(request: NextRequest): Promise<AdminCaller> {
  const token = await getToken({ req: request, secret: getWebEnv().NEXTAUTH_SECRET });
  const caller = readTokenActor(token);
  if (!caller.ok) {
    return {
      ok: false,
      response: NextResponse.json({ error: caller.error }, { status: caller.status }),
    };
  }
  if (readTokenActingAs(token) !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Sign in acting as an administrator.' },
        { status: 403 },
      ),
    };
  }
  return { ok: true, actor: caller.actor };
}

export type ParsedBody<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly response: NextResponse };

/** JSON only (a cross-site form cannot send it), then the strict contract. A 400 names fields, never
 * values: Zod's messages can quote what was sent. */
export async function readJsonBody<S extends z.ZodType>(
  request: NextRequest,
  schema: S,
): Promise<ParsedBody<z.infer<S>>> {
  const contentType = (request.headers.get('content-type') ?? '').toLowerCase();
  if (!contentType.startsWith('application/json')) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Expected application/json' },
        { status: 415 },
      ),
    };
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }),
    };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Bad request',
          fields: parsed.error.issues.map((i) => i.path.join('.')),
        },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

/** The answer for a refusal from the data layer. */
export function refusalResponse(reason: string): NextResponse {
  const refusal = refusalFor(reason);
  return NextResponse.json({ error: refusal.message }, { status: refusal.status });
}
