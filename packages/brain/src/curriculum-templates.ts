// Versioning template definitions into L0 — Stage 08 step 1's other half.
//
// "Version them in L0" is not new Brain mechanism: `remember()`/`ratify()` (api.ts, Stage
// 05 step 9) already are the one typed path anything enters `L0_CONSTITUTION` through, and
// `BrainConstitutionKind` already has a `'TEMPLATE'` member (write-path-schemas.ts, Stage
// 05 step 2) waiting for a first real user. What this module adds is the thin, typed
// wrapper around that existing path so a caller submitting a `TemplateDefinition` cannot
// accidentally shape the payload wrong — the same "unknown plus a Zod parse" discipline
// (rule 8) as everywhere else, not a second write mechanism.
//
// `submitTemplateDefinition` only ever opens a candidate; it does not ratify one itself.
// Ratification is `api.ts`'s own `ratify()`, called by a human decision, and this module
// has no more business skipping that than any other L0 write does (rule 6). It always
// submits with the definition's own `ratifiedAt` forced to `null`: submission necessarily
// happens before a human calls `ratify()`, sometimes long before, so whatever the caller
// passed cannot yet be a true ratification timestamp.
//
// `selectTemplateDefinitions` is the read side: pulling the `'TEMPLATE'`-kind constitution
// candidates a `recall()` already returned back out and parsing each one's `content` as a
// `TemplateDefinition`. `listEffectiveConstitution` (packages/db) only ever returns rows
// that already made it through the write path's own ratification gate, so every candidate
// reaching this function is, by construction, ratified at the row level — this function
// stamps that row-level `recency` (the write path's own `ratifiedAt`) onto the returned
// definition's `ratifiedAt` field, overriding the `null` `submitTemplateDefinition` always
// wrote, rather than trusting a value frozen at submission time. A parse failure here means
// something got into L0 without going through `submitTemplateDefinition` — a data-integrity
// bug, not a normal "not found" case — so it throws rather than silently skipping the row.

import { TemplateDefinition, type ArtefactType } from '@infinite-ai/contracts';
import type { BrainWriteCandidateRow, TenantClient } from '@infinite-ai/db';

import { remember } from './api.js';
import type { RetrievalCandidate } from './retrieval-types.js';

export class CurriculumTemplateError extends Error {
  public override readonly name = 'CurriculumTemplateError';
  constructor(message: string) {
    super(message);
  }
}

/**
 * Opens an `L0_CONSTITUTION` write candidate for one artefact type's template. `key` is
 * the definition's own `artefactType` — one definition per artefact type, the same one-key
 * shape every other `BrainConstitutionKind` already uses. Returns whatever status
 * `remember()` reaches: `AWAITING_RATIFICATION` for the ordinary case, since L0 always
 * requires it.
 */
export async function submitTemplateDefinition(
  tx: TenantClient,
  definition: TemplateDefinition,
  source: string,
  now: Date = new Date(),
): Promise<BrainWriteCandidateRow> {
  const validated = TemplateDefinition.parse({ ...definition, ratifiedAt: null });
  return remember(
    tx,
    {
      targetTier: 'L0_CONSTITUTION',
      rawPayload: {
        key: validated.artefactType,
        kind: 'TEMPLATE',
        content: validated,
      },
      source,
    },
    now,
  );
}

/**
 * Every ratified template definition among `candidates` — typically `RetrievalResult.candidates`
 * from a `recall()` call. `artefactType`, when supplied, narrows to one definition; omitted,
 * returns every template definition retrieval surfaced. Throws `CurriculumTemplateError` for
 * a `'TEMPLATE'`-kind constitution row whose content does not parse — see this module's own
 * header for why that is a data-integrity bug rather than a case to skip.
 */
export function selectTemplateDefinitions(
  candidates: readonly RetrievalCandidate[],
  artefactType?: ArtefactType,
): readonly TemplateDefinition[] {
  const results: TemplateDefinition[] = [];
  for (const candidate of candidates) {
    if (candidate.kind !== 'constitution' || candidate.constitutionKind !== 'TEMPLATE') {
      continue;
    }
    const parsed = TemplateDefinition.safeParse(candidate.content);
    if (!parsed.success) {
      throw new CurriculumTemplateError(
        `L0 TEMPLATE constitution row "${candidate.key}" does not parse as a ` +
          `TemplateDefinition: ${parsed.error.message}`,
      );
    }
    const withRatification = {
      ...parsed.data,
      ratifiedAt: candidate.recency.toISOString(),
    };
    if (artefactType === undefined || withRatification.artefactType === artefactType) {
      results.push(withRatification);
    }
  }
  return results;
}
