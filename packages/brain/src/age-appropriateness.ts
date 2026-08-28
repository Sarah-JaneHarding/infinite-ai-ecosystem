// Age-appropriateness / developmental-readiness clauses into L0 — the same "TEMPLATE"
// pattern curriculum-templates.ts already established for Stage 08 step 1, reused for a
// second kind of free-standing (non-per-document-topic) constitution fact.
//
// `AGE_APPROPRIATENESS` was added to `BrainConstitutionKind` (write-path-schemas.ts)
// alongside this module, its first and only user so far. As with `submitTemplateDefinition`,
// this only ever opens an L0_CONSTITUTION candidate; ratification stays a human decision
// made through `api.ts`'s own `ratify()` (rule 6) — nothing here skips that gate.
//
// One entry per clause (206 of them, `@infinite-ai/contracts`'
// `AGE_APPROPRIATENESS_ENTRIES` — see that file's own header for why granularity is
// per-clause, not per-document), each needing its own stable `key` so it versions
// independently in L0. The entries carry no natural unique key of their own (`clause` is
// free text and not guaranteed unique even within one document), so the key is derived
// from the entry's own fixed position in `AGE_APPROPRIATENESS_ENTRIES` — stable as long as
// that array is only ever appended to, never reordered or spliced. `keyFor` is exported so
// a seeding caller computes the same key `selectAgeAppropriatenessEntries` will later see.
//
// `source.ratifiedBy` is forced to `null` on submission the same way `submitTemplateDefinition`
// forces `ratifiedAt: null` — whatever a caller passed cannot yet be a true sign-off, since
// submission necessarily precedes a human's `ratify()` call. Unlike `TemplateDefinition`,
// this entry shape carries no top-level `ratifiedAt` for the read side to stamp back in:
// `ConstitutionRetrievalCandidate` exposes only `recency` (the row's `ratifiedAt`), not the
// ratifying actor, so there is nothing truthful to overwrite `source.ratifiedBy` with on
// read — it is returned exactly as parsed, still `null`, same as every other CAPS source in
// this codebase before a human countersigns the extraction.

import {
  type AgeAppropriatenessSourceEntry,
  type CapsPhase,
  SourceRef,
} from '@infinite-ai/contracts';
import type { BrainWriteCandidateRow, TenantClient } from '@infinite-ai/db';
import { z } from 'zod';

import { remember } from './api.js';
import type { RetrievalCandidate } from './retrieval-types.js';

export class AgeAppropriatenessError extends Error {
  public override readonly name = 'AgeAppropriatenessError';
  constructor(message: string) {
    super(message);
  }
}

const CapsPhaseSchema = z.enum(['FOUNDATION', 'INTERMEDIATE', 'SENIOR']);

/** Mirrors `AgeAppropriatenessSourceEntry` (packages/contracts) — the "unknown plus a Zod
 * parse" shape (rule 8) `remember()`'s `rawPayload` and this module's read side both need. */
const AgeAppropriatenessEntry = z.object({
  phase: CapsPhaseSchema,
  gradeRange: z.string().min(1),
  subject: z.string().min(1),
  clauseType: z.string().min(1),
  content: z.string().min(1),
  source: SourceRef,
});

/** The stable L0 key for the entry at this position in `AGE_APPROPRIATENESS_ENTRIES`. Zero
 * padded to 3 digits — comfortably wider than the current 206 entries. */
export function keyFor(index: number): string {
  return `age-appropriateness-${String(index).padStart(3, '0')}`;
}

/**
 * Opens an `L0_CONSTITUTION` write candidate for one age-appropriateness clause. `index`
 * must be the entry's own position in `AGE_APPROPRIATENESS_ENTRIES` — see this module's own
 * header for why the key is derived from position rather than content. Returns whatever
 * status `remember()` reaches: `AWAITING_RATIFICATION` for the ordinary case, since L0
 * always requires it.
 */
export async function submitAgeAppropriatenessEntry(
  tx: TenantClient,
  entry: AgeAppropriatenessSourceEntry,
  index: number,
  source: string,
  now: Date = new Date(),
): Promise<BrainWriteCandidateRow> {
  const validated = AgeAppropriatenessEntry.parse({
    ...entry,
    source: { ...entry.source, ratifiedBy: null },
  });
  return remember(
    tx,
    {
      targetTier: 'L0_CONSTITUTION',
      rawPayload: {
        key: keyFor(index),
        kind: 'AGE_APPROPRIATENESS',
        content: validated,
      },
      source,
    },
    now,
  );
}

/**
 * Every ratified age-appropriateness clause among `candidates` — typically
 * `RetrievalResult.candidates` from a `recall()` call. `phase`/`subject`, when supplied,
 * narrow the result; omitted, every clause retrieval surfaced is returned. Throws
 * `AgeAppropriatenessError` for an `'AGE_APPROPRIATENESS'`-kind constitution row whose
 * content does not parse — see this module's own header for why that is a data-integrity
 * bug rather than a case to skip.
 */
export function selectAgeAppropriatenessEntries(
  candidates: readonly RetrievalCandidate[],
  filters: { readonly phase?: CapsPhase; readonly subject?: string } = {},
): readonly AgeAppropriatenessSourceEntry[] {
  const results: AgeAppropriatenessSourceEntry[] = [];
  for (const candidate of candidates) {
    if (
      candidate.kind !== 'constitution' ||
      candidate.constitutionKind !== 'AGE_APPROPRIATENESS'
    ) {
      continue;
    }
    const parsed = AgeAppropriatenessEntry.safeParse(candidate.content);
    if (!parsed.success) {
      throw new AgeAppropriatenessError(
        `L0 AGE_APPROPRIATENESS constitution row "${candidate.key}" does not parse as an ` +
          `AgeAppropriatenessSourceEntry: ${parsed.error.message}`,
      );
    }
    if (filters.phase !== undefined && parsed.data.phase !== filters.phase) continue;
    if (filters.subject !== undefined && parsed.data.subject !== filters.subject)
      continue;
    results.push(parsed.data);
  }
  return results;
}
