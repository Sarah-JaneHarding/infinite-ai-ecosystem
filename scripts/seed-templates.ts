#!/usr/bin/env tsx
/**
 * Stage 08 — seed lesson-plan template definitions for all dev seed tenants.
 *
 * Creates AWAITING_RATIFICATION Brain write candidates (kind: TEMPLATE, tier:
 * L0_CONSTITUTION) for every known TemplateDefinition in @infinite-ai/contracts.
 * Run this before `pnpm templates:ratify`.
 *
 * Requires DATABASE_URL to be set (via .env or the environment).
 *
 * Usage: pnpm templates:seed
 */

import { withTenant } from '@infinite-ai/db';
import { submitTemplateDefinition } from '@infinite-ai/brain';
import { LESSON_PLAN_TEMPLATE_BENJAMIN_PINE } from '@infinite-ai/contracts';

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

const TEMPLATES = [
  {
    definition: LESSON_PLAN_TEMPLATE_BENJAMIN_PINE,
    source: 'benjamin-pine-lesson-plan-2026',
    label: 'Benjamin Pine lesson-plan template',
  },
] as const;

const now = new Date();

for (const tenant of SEED_TENANTS) {
  let submitted = 0;
  await withTenant(
    { tenantId: tenant.tenantId, actorId: tenant.actorId },
    async (tx) => {
      for (const t of TEMPLATES) {
        await submitTemplateDefinition(tx, t.definition, t.source, now);
        submitted++;
      }
    },
    { timeoutMs: 60_000 },
  );
  console.log(`[${tenant.name}] submitted ${submitted} template candidate(s)`);
}

console.log(
  'Done. Run pnpm templates:ratify to countersign candidates and commit them to brain_constitution.',
);
