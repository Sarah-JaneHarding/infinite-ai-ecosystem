#!/usr/bin/env tsx
/**
 * Stage 30 — ratify pending L0_CONSTITUTION curriculum candidates for all dev seed tenants.
 *
 * Advances every AWAITING_RATIFICATION L0_CONSTITUTION write candidate to
 * RETENTION_SCHEDULED via the Brain API's `ratify()`. After this runs,
 * `listEffectiveConstitution()` returns committed records and CE-01 can retrieve real
 * curriculum content.
 *
 * Requires DATABASE_URL to be set (via .env or the environment).
 * Run `pnpm curriculum:seed` first.
 *
 * Usage: pnpm curriculum:ratify
 */

import { withTenant } from '@infinite-ai/db';
import { ratifyCurriculumForTenant } from '@infinite-ai/curriculum-seed';

const SEED_TENANTS = [
  {
    tenantId: '10000000-0000-4000-8000-000000000001',
    actorId: 'system-ratifier',
    name: 'Kleinbos Primary',
  },
  {
    tenantId: '10000000-0000-4000-8000-000000000002',
    actorId: 'system-ratifier',
    name: 'Thabo Mbeki Primary',
  },
  {
    tenantId: '10000000-0000-4000-8000-000000000003',
    actorId: 'system-ratifier',
    name: 'Umoya Schools Trust',
  },
] as const;

const now = new Date();

for (const tenant of SEED_TENANTS) {
  const result = await withTenant(
    { tenantId: tenant.tenantId, actorId: tenant.actorId },
    (tx) => ratifyCurriculumForTenant(tx, tenant.actorId, now),
  );
  console.log(`[${tenant.name}] ratified: ${result.ratified} L0 constitution records`);
}

console.log(
  'Done. CE-01 can now retrieve curriculum content via listEffectiveConstitution.',
);
