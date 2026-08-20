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

const SEED_TENANTS = [
  {
    tenantId: '10000000-0000-4000-8000-000000000001',
    actorId: 'system-seed',
    name: 'Kleinbos Primary',
  },
  {
    tenantId: '10000000-0000-4000-8000-000000000002',
    actorId: 'system-seed',
    name: 'Thabo Mbeki Primary',
  },
  {
    tenantId: '10000000-0000-4000-8000-000000000003',
    actorId: 'system-seed',
    name: 'Umoya Schools Trust',
  },
] as const;

const now = new Date();

for (const tenant of SEED_TENANTS) {
  const result = await withTenant(
    { tenantId: tenant.tenantId, actorId: tenant.actorId },
    (tx) => seedCurriculumFromContracts(tx, tenant.actorId, now),
  );
  console.log(
    `[${tenant.name}] seeded: ${result.capsSubmitted} CAPS + ${result.atpSubmitted} ATP` +
      ` = ${result.candidateIds.length} candidates`,
  );
}

console.log(
  'Done. Run pnpm curriculum:ratify to commit candidates to brain_constitution.',
);
