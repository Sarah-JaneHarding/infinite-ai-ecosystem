#!/usr/bin/env tsx
/**
 * Stage 30 — seed L0 curriculum candidates for all dev seed tenants.
 *
 * Creates AWAITING_RATIFICATION Brain write candidates for every CAPS and ATP source
 * document in @infinite-ai/contracts. Run this before `pnpm curriculum:ratify`.
 *
 * Requires DATABASE_URL to be set (via .env or the environment).
 *
 * Usage: pnpm curriculum:seed
 */

import { withTenant } from '@infinite-ai/db';
import { seedCurriculumFromContracts } from '@infinite-ai/curriculum-seed';

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
  const result = await withTenant(
    { tenantId: tenant.tenantId, actorId: tenant.actorId },
    (tx) => seedCurriculumFromContracts(tx, tenant.actorId, now),
    // Every CAPS/ATP source document goes through the full audited Brain write-path in
    // this one transaction — well over a hundred documents for the fullest tenant.
    // Prisma's 5000ms interactive-transaction default is tuned for a request, not a seed.
    { timeoutMs: 120_000 },
  );
  console.log(
    `[${tenant.name}] seeded: ${result.capsSubmitted} CAPS + ${result.atpSubmitted} ATP` +
      ` = ${result.candidateIds.length} candidates`,
  );
}

console.log(
  'Done. Run pnpm curriculum:ratify to commit candidates to brain_constitution.',
);
