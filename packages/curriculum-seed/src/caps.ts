// CAPS source → L0_CONSTITUTION (CAPS_CANON) write path — Stage 29.
//
// Mirrors the pattern of `packages/brain/src/curriculum-templates.ts`:
//   - `buildCapsL0Payload` is pure (no DB) and is the unit-testable half;
//   - `submitCapsSource` calls `remember()` with that payload and is integration-only.
//   - `selectCapsDocuments` reads back from retrieval candidates — also pure.
//
// The L0 key is the document's own `documentId` (e.g. 'caps-mathematics-ip-gr46-2011'),
// which is stable across re-ingests and versioning — the write-path's own contradiction
// logic will resolve a newer candidate against an older committed record using this key.

import { remember } from '@infinite-ai/brain';
import type { BrainWriteCandidateRow, TenantClient } from '@infinite-ai/db';

import type { RetrievalCandidate } from '@infinite-ai/brain';
import type { BrainWriteCandidateInput } from '@infinite-ai/db';
import { CapsCanonContent, CurriculumSeedError, type CapsSourceInfo } from './types.js';

/**
 * Builds the `BrainWriteCandidateInput` for one CAPS source document without touching the
 * database. The returned object is passed directly to `remember()` by `submitCapsSource`.
 */
export function buildCapsL0Payload(
  info: CapsSourceInfo,
  submittedBy: string,
): BrainWriteCandidateInput {
  if (!info.documentId.trim()) {
    throw new CurriculumSeedError('CAPS source documentId must not be empty.');
  }
  if (!info.contentAreas.length) {
    throw new CurriculumSeedError(
      `CAPS source "${info.documentId}" has no content areas — refusing to submit an empty record.`,
    );
  }

  const content: CapsCanonContent = {
    documentId: info.documentId,
    documentVersion: info.documentVersion,
    title: info.title,
    subject: info.subject,
    phase: info.phase,
    grades: [...info.grades],
    contentAreas: [...info.contentAreas],
    weightings: info.weightings.map((w) => ({
      contentArea: w.contentArea,
      grade: w.grade,
      weightingPercent: w.weightingPercent,
      clause: w.clause,
    })),
    topicCount: info.topicCount,
    source: {
      documentId: info.source.documentId,
      documentVersion: info.source.documentVersion,
      clause: info.source.clause,
      ratifiedBy: info.source.ratifiedBy,
    },
  };

  return {
    targetTier: 'L0_CONSTITUTION',
    rawPayload: {
      key: info.documentId,
      kind: 'CAPS_CANON',
      content,
    },
    source: `curriculum-seed:${info.documentId}:${info.documentVersion}`,
    confidence: 1,
    createdBy: submittedBy,
  };
}

/**
 * Opens an `L0_CONSTITUTION` candidate for one CAPS source document. Returns
 * `AWAITING_RATIFICATION` — a human ratifies via `ratify()` before CE-01 can use the record.
 */
export async function submitCapsSource(
  tx: TenantClient,
  info: CapsSourceInfo,
  submittedBy: string,
  now: Date = new Date(),
): Promise<BrainWriteCandidateRow> {
  const input = buildCapsL0Payload(info, submittedBy);
  return remember(tx, input, now);
}

/**
 * Filters retrieval candidates to ratified CAPS_CANON records and parses each one's
 * content as `CapsCanonContent`. Throws `CurriculumSeedError` for a record whose content
 * does not parse — that means something reached L0 without going through `submitCapsSource`,
 * a data-integrity bug rather than an ordinary not-found.
 *
 * `subject` and `phase` narrow the results when supplied; omit either to return all.
 */
export function selectCapsDocuments(
  candidates: readonly RetrievalCandidate[],
  opts: { subject?: string; phase?: CapsCanonContent['phase'] } = {},
): readonly CapsCanonContent[] {
  const results: CapsCanonContent[] = [];
  for (const candidate of candidates) {
    if (
      candidate.kind !== 'constitution' ||
      candidate.constitutionKind !== 'CAPS_CANON'
    ) {
      continue;
    }
    const parsed = CapsCanonContent.safeParse(candidate.content);
    if (!parsed.success) {
      throw new CurriculumSeedError(
        `L0 CAPS_CANON constitution row "${candidate.key}" does not parse as CapsCanonContent: ${parsed.error.message}`,
      );
    }
    const doc = parsed.data;
    if (opts.subject !== undefined && doc.subject !== opts.subject) continue;
    if (opts.phase !== undefined && doc.phase !== opts.phase) continue;
    results.push(doc);
  }
  return results;
}
