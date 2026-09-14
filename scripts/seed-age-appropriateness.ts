#!/usr/bin/env tsx
/**
 * Seed L0 age-appropriateness/developmental-readiness candidates for all dev seed tenants.
 *
 * Creates AWAITING_RATIFICATION Brain write candidates for every entry in
 * @infinite-ai/contracts' AGE_APPROPRIATENESS_ENTRIES (206 paraphrased DBE CAPS clauses —
 * see packages/brain/src/age-appropriateness.ts and docs/sources/pedagogy/
 * age-appropriateness-developmental-readiness/SOURCES.md). Run this before
 * `pnpm age-appropriateness:ratify`.
 *
 * Requires DATABASE_URL to be set (via .env or the environment).
 *
 * Usage: pnpm age-appropriateness:seed
 */

import { AGE_APPROPRIATENESS_ENTRIES } from '@infinite-ai/contracts';
import { submitAgeAppropriatenessEntry } from '@infinite-ai/brain';
import { withTenant } from '@infinite-ai/db';

// `actorId` must be a UUID — `withTenant()` refuses anything else (rule 5). Same
// well-formed placeholder `packages/db/prisma/seed.ts` uses (`SEED_ACTOR`) for the system
// account that creates these same three dev tenants.
const SEED_ACTOR = '00000000-0000-4000-8000-00000000f00d';

const SEED_TENANTS = [
  {
    tenantId: '10000000-0000-4000-8000-000000000001',
    actorId: SEED_ACTOR,
    name: 'Kleinbos Primary',
  },
  {
    tenantId: '10000000-0000-4000-8000-000000000002',
    actorId: SEED_ACTOR,
    name: 'Thabo Mbeki Primary',
  },
  {
    tenantId: '10000000-0000-4000-8000-000000000003',
    actorId: SEED_ACTOR,
    name: 'Umoya Schools Trust',
  },
] as const;

const now = new Date();

for (const tenant of SEED_TENANTS) {
  const candidateIds = await withTenant(
    { tenantId: tenant.tenantId, actorId: tenant.actorId },
    async (tx) => {
      const ids: string[] = [];
      for (const [index, entry] of AGE_APPROPRIATENESS_ENTRIES.entries()) {
        const candidate = await submitAgeAppropriatenessEntry(
          tx,
          entry,
          index,
          'age-appropriateness-seed',
          now,
        );
        ids.push(candidate.id);
      }
      return ids;
    },
    // 206 entries through the full audited Brain write-path in one transaction — Prisma's
    // 5000ms interactive-transaction default is tuned for a request, not a seed. Twice
    // curriculum:seed's own 120_000ms budget since this dataset is roughly double the
    // per-tenant document count that budget was tuned against.
    { timeoutMs: 240_000 },
  );
  console.log(
    `[${tenant.name}] seeded: ${candidateIds.length} age-appropriateness candidates`,
  );
}

console.log(
  'Done. Run pnpm age-appropriateness:ratify to commit candidates to brain_constitution.',
);
