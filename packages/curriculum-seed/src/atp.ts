// ATP source → L0_CONSTITUTION (ATP_CALENDAR) write path — Stage 29.
//
// Mirrors the pattern of `packages/brain/src/curriculum-templates.ts` and this
// package's own `caps.ts`:
//   - `buildAtpL0Payload` is pure (no DB) and is the unit-testable half;
//   - `submitAtpSource` calls `remember()` with that payload and is integration-only.
//   - `selectAtpDocuments` reads back from retrieval candidates — also pure.
//
// The L0 key is the document's own `sourceId` (e.g. 'atp-gr4-maths-2023'), which is
// stable across re-ingests — the write-path contradiction logic resolves a newer
// candidate against an older committed record using this key.

import { remember } from '@infinite-ai/brain';
import type { RetrievalCandidate } from '@infinite-ai/brain';
import type { ATPSourceDocument } from '@infinite-ai/contracts';
import type {
  BrainWriteCandidateInput,
  BrainWriteCandidateRow,
  TenantClient,
} from '@infinite-ai/db';

import { AtpCalendarContent, CurriculumSeedError } from './types.js';

/**
 * Builds the `BrainWriteCandidateInput` for one ATP source document without touching
 * the database. The returned object is passed directly to `remember()` by `submitAtpSource`.
 */
export function buildAtpL0Payload(
  doc: ATPSourceDocument,
  submittedBy: string,
): BrainWriteCandidateInput {
  if (!doc.sourceId.trim()) {
    throw new CurriculumSeedError('ATP sourceId must not be empty.');
  }
  if (!doc.topics.length) {
    throw new CurriculumSeedError(
      `ATP source "${doc.sourceId}" has no topic blocks — refusing to submit an empty record.`,
    );
  }

  const content: AtpCalendarContent = {
    documentId: doc.sourceId,
    sourceId: doc.sourceId,
    grade: doc.grade,
    phase: doc.phase,
    subject: doc.subject,
    atpYear: doc.atpYear,
    sourceDescription: doc.sourceDescription,
    topicCount: doc.topics.length,
    fatCount: doc.fats.length,
    topics: doc.topics.map((t) => ({
      term: t.term,
      weekStart: t.weekStart,
      weekEnd: t.weekEnd,
      contentArea: t.contentArea,
      topic: t.topic,
      assessmentType: t.assessmentType,
    })),
    fats: doc.fats.map((f) => ({
      term: f.term,
      fatNumber: f.fatNumber,
      fatType: f.fatType,
      fatDescription: f.fatDescription,
    })),
    source: {
      documentId: doc.sourceId,
      documentVersion: String(doc.atpYear),
      clause: 'ATP source document',
      ratifiedBy: null,
    },
  };

  return {
    targetTier: 'L0_CONSTITUTION',
    rawPayload: {
      key: doc.sourceId,
      kind: 'ATP_CALENDAR',
      content,
    },
    source: `curriculum-seed:${doc.sourceId}:${doc.atpYear}`,
    confidence: 1,
    createdBy: submittedBy,
  };
}

/**
 * Opens an `L0_CONSTITUTION` candidate for one ATP source document. Returns
 * `AWAITING_RATIFICATION` — a human ratifies via `ratify()` before CE-02 can use the record.
 */
export async function submitAtpSource(
  tx: TenantClient,
  doc: ATPSourceDocument,
  submittedBy: string,
  now: Date = new Date(),
): Promise<BrainWriteCandidateRow> {
  const input = buildAtpL0Payload(doc, submittedBy);
  return remember(tx, input, now);
}

/**
 * Filters retrieval candidates to ratified ATP_CALENDAR records and parses each one's
 * content as `AtpCalendarContent`. Throws `CurriculumSeedError` for a record whose content
 * does not parse — data-integrity bug rather than an ordinary not-found.
 *
 * `grade`, `subject`, and `atpYear` narrow the results when supplied; omit any to return all.
 */
export function selectAtpDocuments(
  candidates: readonly RetrievalCandidate[],
  opts: { grade?: string; subject?: string; atpYear?: number } = {},
): readonly AtpCalendarContent[] {
  const results: AtpCalendarContent[] = [];
  for (const candidate of candidates) {
    if (
      candidate.kind !== 'constitution' ||
      candidate.constitutionKind !== 'ATP_CALENDAR'
    ) {
      continue;
    }
    const parsed = AtpCalendarContent.safeParse(candidate.content);
    if (!parsed.success) {
      throw new CurriculumSeedError(
        `L0 ATP_CALENDAR constitution row "${candidate.key}" does not parse as AtpCalendarContent: ${parsed.error.message}`,
      );
    }
    const doc = parsed.data;
    if (opts.grade !== undefined && doc.grade !== opts.grade) continue;
    if (opts.subject !== undefined && doc.subject !== opts.subject) continue;
    if (opts.atpYear !== undefined && doc.atpYear !== opts.atpYear) continue;
    results.push(doc);
  }
  return results;
}
