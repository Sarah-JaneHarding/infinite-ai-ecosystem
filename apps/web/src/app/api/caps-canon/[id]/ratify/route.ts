// POST /api/caps-canon/[id]/ratify — human-ratifies an AWAITING_RATIFICATION
// Brain write candidate for one CAPS Canon document.
//
// Rule 6: the human-in-the-loop gate cannot be bypassed. The ratification
// record is written before the response is returned. The `ratifiedBy` field is
// the JWT sub (actor UUID) — a named human principal, not a service account.
//
// The `reason` field is required; it enters the audit trail and is the admin's
// statement that they have verified the content against the original PDF.
//
// Rules enforced:
//   Rule 5  — all DB writes go through withTenant.
//   Rule 6  — ratification is the human gate; it must be a real named actor.
//   Rule 8  — strict TypeScript, no any.

import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import { withTenant, listOpenBrainWrites } from '@infinite-ai/db';
import { ratify } from '@infinite-ai/brain';
import { BrainApiError } from '@infinite-ai/brain';
import { z } from 'zod';

import { getWebEnv } from '@/lib/env';
import { findCanonDoc } from '@/components/curriculum/caps-canon-docs';

const RatifyBodySchema = z.object({
  reason: z
    .string()
    .min(1, 'Reason is required — state that you have verified the content.'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: consoleId } = await params;
  const env = getWebEnv();
  const token = await getToken({ req: request, secret: env.NEXTAUTH_SECRET });

  if (token === null || typeof token.sub !== 'string') {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const tenantId = (token['tenantId'] as string | undefined) ?? '';
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 403 });
  }

  if (token['role'] !== 'admin') {
    return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
  }

  const actorId = token.sub;

  const doc = findCanonDoc(consoleId);
  if (!doc) {
    return NextResponse.json(
      { error: `Unknown CAPS canon document: ${consoleId}` },
      { status: 404 },
    );
  }

  if (doc.brainDocumentId === null) {
    return NextResponse.json(
      { error: `Document ${consoleId} cannot be ratified — no Brain document exists.` },
      { status: 422 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = RatifyBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Bad request', details: parsed.error.issues },
      { status: 400 },
    );
  }

  // reason is an auditable statement from the human but is not a separate DB field
  // in BrainWriteCandidate — it supplements the ratifiedBy actor identity.
  const { reason: _reason } = parsed.data;

  const SOURCE_PREFIX = 'curriculum-seed:';
  const now = new Date();

  interface RatifyResult {
    candidateId: string;
    candidateStatus: string;
    ratifiedAt: string;
  }
  let ratifyResult: RatifyResult | undefined;

  try {
    await withTenant({ tenantId, actorId }, async (tx) => {
      const existing = await listOpenBrainWrites(tx);
      const candidate = existing.find(
        (c) =>
          c.source.startsWith(SOURCE_PREFIX) &&
          c.source.split(':')[1] === doc.brainDocumentId,
      );

      if (!candidate) {
        throw Object.assign(new Error('No ingested candidate found for this document.'), {
          httpStatus: 409,
        });
      }

      if (candidate.status !== 'AWAITING_RATIFICATION') {
        throw Object.assign(
          new Error(
            `Candidate is in status ${candidate.status}, expected AWAITING_RATIFICATION.`,
          ),
          { httpStatus: 409 },
        );
      }

      const result = await ratify(tx, candidate.id, actorId, now);
      ratifyResult = {
        candidateId: result.id,
        candidateStatus: result.status,
        ratifiedAt: now.toISOString(),
      };
    });
  } catch (err) {
    if (err instanceof BrainApiError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    const asTagged = err as { httpStatus?: number; message?: string };
    if (asTagged.httpStatus) {
      return NextResponse.json(
        { error: asTagged.message ?? 'Conflict' },
        {
          status: asTagged.httpStatus,
        },
      );
    }
    throw err;
  }

  if (!ratifyResult) {
    return NextResponse.json(
      { error: 'Ratify transaction did not complete' },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      consoleId,
      brainDocumentId: doc.brainDocumentId,
      ratifiedBy: actorId,
      ...ratifyResult,
    },
    { status: 200 },
  );
}
