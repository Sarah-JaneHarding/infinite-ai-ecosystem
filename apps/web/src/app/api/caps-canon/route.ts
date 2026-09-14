// GET /api/caps-canon — returns the Brain write-candidate and constitution status
// for every CAPS Canon document.
//
// The response is a flat map: console doc ID → { status, candidateId?, ratifiedAt? }.
// "Downloaded" state (SHA-256 verified) is browser-local (localStorage) and is not
// tracked here — the client merges it with the server response.
//
// Rules enforced:
//   Rule 5 — every DB read goes through withTenant.
//   Rule 1 — only admin-role callers may access this route.

import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import { withTenant } from '@infinite-ai/db';
import { listOpenBrainWrites, listEffectiveConstitution } from '@infinite-ai/db';
import type { BrainWriteStatus } from '@infinite-ai/brain';

import { getWebEnv } from '@/lib/env';
import { ALL_CAPS_CANON_DOCS } from '@/components/curriculum/caps-canon-docs';

export interface CapsCanonDocStatus {
  readonly consoleId: string;
  readonly brainDocumentId: string | null;
  /** null = never submitted (or download-only). */
  readonly candidateId: string | null;
  /** Status of the Brain write candidate, or null if none exists. */
  readonly candidateStatus: BrainWriteStatus | null;
  /** Populated once the write candidate reaches RETENTION_SCHEDULED (ratified+committed). */
  readonly ratifiedAt: string | null;
  readonly ratifiedBy: string | null;
  /** Whether this console doc's Brain document is already committed to the constitution. */
  readonly constitutionRowId: string | null;
}

export interface CapsCanonStatusResponse {
  readonly docs: readonly CapsCanonDocStatus[];
}

export async function GET(request: NextRequest): Promise<NextResponse> {
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

  let candidates: Awaited<ReturnType<typeof listOpenBrainWrites>>;
  let constitutionRows: Awaited<ReturnType<typeof listEffectiveConstitution>>;

  await withTenant({ tenantId, actorId }, async (tx) => {
    [candidates, constitutionRows] = await Promise.all([
      listOpenBrainWrites(tx),
      listEffectiveConstitution(tx),
    ]);
  });

  // Index constitution by `key` (which matches CapsSourceInfo.documentId for CAPS_CANON kind).
  const constitutionByKey = new Map(
    constitutionRows!.filter((r) => r.kind === 'CAPS_CANON').map((r) => [r.key, r]),
  );

  // submitCapsSource sets source = `curriculum-seed:${documentId}:${documentVersion}`.
  // Split on ':' and take index 1 to get the documentId.
  const SOURCE_PREFIX = 'curriculum-seed:';
  const candidateByDocId = new Map(
    candidates!
      .filter((c) => c.source.startsWith(SOURCE_PREFIX))
      .map((c) => {
        const parts = c.source.split(':');
        // parts: ['curriculum-seed', documentId, documentVersion]
        const docId = parts[1] ?? '';
        return [docId, c] as const;
      }),
  );

  const docs: CapsCanonDocStatus[] = ALL_CAPS_CANON_DOCS.map((doc) => {
    const brainDocId = doc.brainDocumentId;
    if (brainDocId === null) {
      return {
        consoleId: doc.id,
        brainDocumentId: null,
        candidateId: null,
        candidateStatus: null,
        ratifiedAt: null,
        ratifiedBy: null,
        constitutionRowId: null,
      };
    }

    const candidate = candidateByDocId.get(brainDocId);
    const constitutionRow = constitutionByKey.get(brainDocId);

    return {
      consoleId: doc.id,
      brainDocumentId: brainDocId,
      candidateId: candidate?.id ?? null,
      candidateStatus: (candidate?.status as BrainWriteStatus | undefined) ?? null,
      ratifiedAt: candidate?.ratifiedAt?.toISOString() ?? null,
      ratifiedBy: candidate?.ratifiedBy ?? null,
      constitutionRowId: constitutionRow?.id ?? null,
    };
  });

  return NextResponse.json({ docs } satisfies CapsCanonStatusResponse, { status: 200 });
}
