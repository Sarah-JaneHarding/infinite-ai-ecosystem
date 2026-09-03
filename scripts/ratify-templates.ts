#!/usr/bin/env tsx
/**
 * Stage 08 — ratify pending L0_CONSTITUTION template candidates for all dev seed tenants.
 *
 * Advances every AWAITING_RATIFICATION L0_CONSTITUTION TEMPLATE candidate to
 * RETENTION_SCHEDULED via the Brain API's `ratify()`. After this runs,
 * `selectTemplateDefinitions()` returns committed records and CE-05 can render
 * lesson plans against the school's own template structure.
 *
 * Requires DATABASE_URL to be set (via .env or the environment).
 * Run `pnpm templates:seed` first.
 *
 * Usage: pnpm templates:ratify
 *
 * PILOT NOTE: For production ratification, replace SEED_ACTOR below with the
 * principal's own UUID from Keycloak and SEED_TENANTS with the real pilot tenant IDs.
 * The SEED_ACTOR placeholder is valid only for development environments.
 */

import { withTenant, listOpenBrainWrites } from '@infinite-ai/db';
import { ratify } from '@infinite-ai/brain';

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
    async (tx) => {
      const candidates = await listOpenBrainWrites(tx);
      const pending = candidates.filter(
        (c) =>
          c.status === 'AWAITING_RATIFICATION' &&
          c.targetTier === 'L0_CONSTITUTION' &&
          (c.rawPayload as { kind?: string }).kind === 'TEMPLATE',
      );
      for (const candidate of pending) {
        await ratify(tx, candidate.id, tenant.actorId, now);
      }
      return { ratified: pending.length };
    },
    { timeoutMs: 60_000 },
  );
  console.log(
    `[${tenant.name}] ratified: ${result.ratified} template constitution record(s)`,
  );
}

console.log(
  'Done. CE-05 can now retrieve the school lesson-plan template via selectTemplateDefinitions.',
);
