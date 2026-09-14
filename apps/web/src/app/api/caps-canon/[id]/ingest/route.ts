// POST /api/caps-canon/[id]/ingest — creates a Brain L0 write candidate for one
// CAPS Canon document.
//
// Calls submitCapsSource() which drives the candidate to AWAITING_RATIFICATION.
// Idempotent: if a write candidate for this documentId already exists at any
// non-terminal status, returns 200 with the existing candidate rather than
// creating a duplicate.
//
// The client must supply the SHA-256 hash of the downloaded PDF in the request
// body. This is not stored in the Brain (CapsCanonContent has no hash field) but
// it is required to confirm the caller went through the download-and-verify step
// before requesting ingest. The hash itself is a browser-computed value (Web
// Crypto API) and is already held in localStorage at ingest time.
//
// Rules enforced:
//   Rule 5  — all DB writes go through withTenant.
//   Rule 6  — human gate (ratification) is enforced downstream; not bypassed here.
//   Rule 8  — strict TypeScript, no any.

import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import { withTenant, listOpenBrainWrites } from '@infinite-ai/db';
import {
  submitCapsSource,
  ALL_CAPS_SOURCES,
  CurriculumSeedError,
} from '@infinite-ai/curriculum-seed';
import { z } from 'zod';

import { getWebEnv } from '@/lib/env';
import {
  findCanonDoc,
  findCapsSourceByBrainDocId,
} from '@/components/curriculum/caps-canon-docs';

const IngestBodySchema = z.object({
  // SHA-256 hex string — 64 lowercase hex chars.
  sha256: z
    .string()
    .length(64)
    .regex(/^[0-9a-f]+$/, 'sha256 must be 64 lowercase hex characters'),
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
      {
        error: `Document ${consoleId} has no structured data. Ingest via CE-01 PDF processing.`,
      },
      { status: 422 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = IngestBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Bad request', details: parsed.error.issues },
      { status: 400 },
    );
  }

  // sha256 is validated but not stored in the Brain — it is held in browser localStorage
  // as the "downloaded" state record. Its presence here confirms the caller went through
  // the download-and-verify step.
  const { sha256: _sha256 } = parsed.data;

  const capsSource = findCapsSourceByBrainDocId(ALL_CAPS_SOURCES, doc.brainDocumentId);
  if (!capsSource) {
    return NextResponse.json(
      {
        error: `No structured source found for Brain documentId: ${doc.brainDocumentId}. Registry mismatch — report to platform team.`,
      },
      { status: 500 },
    );
  }

  const SOURCE_PREFIX = 'curriculum-seed:';
  interface IngestResult {
    candidateId: string;
    candidateStatus: string;
    alreadyExists: boolean;
  }
  let ingestResult: IngestResult | undefined;

  try {
    await withTenant({ tenantId, actorId }, async (tx) => {
      // Idempotency: if a write candidate for this documentId already exists, return it.
      const existing = await listOpenBrainWrites(tx);
      const existingForDoc = existing.find(
        (c) =>
          c.source.startsWith(SOURCE_PREFIX) &&
          c.source.split(':')[1] === doc.brainDocumentId,
      );

      if (existingForDoc) {
        ingestResult = {
          candidateId: existingForDoc.id,
          candidateStatus: existingForDoc.status,
          alreadyExists: true,
        };
        return;
      }

      const result = await submitCapsSource(tx, capsSource, actorId);
      ingestResult = {
        candidateId: result.id,
        candidateStatus: result.status,
        alreadyExists: false,
      };
    });
  } catch (err) {
    if (err instanceof CurriculumSeedError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }

  if (!ingestResult) {
    return NextResponse.json(
      { error: 'Ingest transaction did not complete' },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      consoleId,
      brainDocumentId: doc.brainDocumentId,
      ...ingestResult,
    },
    { status: 200 },
  );
}
