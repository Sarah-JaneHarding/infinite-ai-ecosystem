// POST /api/approvals/[id]/decide — records a human gate decision.
//
// The route only RECORDS the decision (via decideHumanGate); it does not re-enqueue the
// pipeline run. The BullMQ worker re-drives the run and fires the LE signal when it picks
// up the next job for that run — this keeps the Route Handler thin and the orchestrator's
// re-entry logic in one place (the worker).
//
// Rule 6: the approval record exists before any response is returned; there is no escape
// hatch. Rule 5: every DB operation goes through withTenant.

import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { type NextRequest } from 'next/server';
import { withTenant } from '@infinite-ai/db';
import {
  decideHumanGate,
  OrchestratorRunnerError,
  type HumanGateDecisionInput,
} from '@infinite-ai/orchestrator';
import { z } from 'zod';

import { getWebEnv } from '@/lib/env';

// The run ID is passed in the request body alongside the decision because the Route Handler
// receives the TASK id (from the URL) but decideHumanGate needs the RUN id. The client
// must supply it — the web UI fetches the task detail (which includes runId) before rendering.
const DecideBodySchema = z.object({
  runId: z.string().min(1),
  outcome: z.enum(['APPROVED', 'REJECTED', 'EDITED']),
  reason: z.string().min(1),
  editDiff: z.unknown().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: taskId } = await params;

  // Extract the JWT sub (actor UUID) — sessions do not expose userId directly.
  const env = getWebEnv();
  const token = await getToken({
    req: request,
    secret: env.NEXTAUTH_SECRET,
  });

  if (token === null || typeof token.sub !== 'string') {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const tenantId = (token['tenantId'] as string | undefined) ?? '';
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 403 });
  }

  const actorId = token.sub; // JWT sub is the Keycloak user UUID (pseudonymous, not a name)

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = DecideBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Bad request', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { runId, outcome, reason, editDiff } = parsed.data;

  const input: HumanGateDecisionInput = {
    outcome,
    decidedBy: actorId,
    reason,
    ...(editDiff !== undefined ? { editDiff } : {}),
  };

  try {
    await withTenant({ tenantId, actorId }, async (tx) => {
      await decideHumanGate(tx, runId, input);
    });
  } catch (err) {
    if (err instanceof OrchestratorRunnerError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }

  return NextResponse.json({ taskId, runId, outcome }, { status: 200 });
}
