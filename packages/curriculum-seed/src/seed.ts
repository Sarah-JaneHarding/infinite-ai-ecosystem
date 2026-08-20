// Top-level seeder — Stage 29.
//
// `seedCurriculumFromContracts` is the single entry point that callers (scripts,
// agent tools, integration tests) use to load all CAPS and ATP source data from
// @infinite-ai/contracts into Brain L0 in one pass.
//
// The function is deliberately not idempotent by design: `remember()` already
// handles re-ingestion via its write-path contradiction logic (duplicate keys at L0
// open a new candidate which the ratifier resolves against the existing committed
// record). Callers should not guard against duplicate runs.

import type { TenantClient } from '@infinite-ai/db';
import {
  ATP_FOUNDATION_SOURCES,
  ATP_INTERMEDIATE_SOURCES,
  ATP_SENIOR_SOURCES,
} from '@infinite-ai/contracts';
// ATP_PENDING_REGISTRY stubs have no topic blocks and would fail buildAtpL0Payload
// validation; they are excluded until their source data arrives (OQ-002).

import { ALL_CAPS_SOURCES } from './all-caps-sources.js';
import { submitAtpSource } from './atp.js';
import { submitCapsSource } from './caps.js';
import type { SeedResult } from './types.js';

/**
 * Loads all 21 CAPS source documents and all ATP source documents from
 * `@infinite-ai/contracts` into Brain L0 as `AWAITING_RATIFICATION` candidates.
 *
 * Returns a summary of what was submitted. Throws on the first error — callers
 * should wrap in a transaction if they need rollback semantics.
 *
 * Pending ATP stubs (IP-MULTI subjects) are skipped: they have no topic blocks and
 * `buildAtpL0Payload` would reject them. This is intentional — they will be seeded
 * once the underlying source data arrives (OQ-002).
 */
export async function seedCurriculumFromContracts(
  tx: TenantClient,
  submittedBy: string,
  now: Date = new Date(),
): Promise<SeedResult> {
  const candidateIds: string[] = [];

  for (const info of ALL_CAPS_SOURCES) {
    const row = await submitCapsSource(tx, info, submittedBy, now);
    candidateIds.push(row.id);
  }

  const atpSources = [
    ...ATP_FOUNDATION_SOURCES,
    ...ATP_INTERMEDIATE_SOURCES,
    ...ATP_SENIOR_SOURCES,
  ];

  for (const doc of atpSources) {
    const row = await submitAtpSource(tx, doc, submittedBy, now);
    candidateIds.push(row.id);
  }

  return {
    capsSubmitted: ALL_CAPS_SOURCES.length,
    atpSubmitted: atpSources.length,
    candidateIds,
  };
}
