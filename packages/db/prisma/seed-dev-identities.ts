// Seeds an account and a role assignment for each dev login — development only.
//
// `pnpm --filter @infinite-ai/db db:seed:identities`, after `db:seed` (the tenant must exist).
// Run it as the migrator, like db:seed. Idempotent: every write is an upsert on a fixed id
// with an empty update, so a second run changes nothing.

import { loadDatabaseUrl } from '@infinite-ai/config';
import type { PrismaClient } from '@prisma/client';

import { createPrismaClient } from '../src/client.js';

import { DEV_IDENTITIES, DEV_TENANT_ID, type DevIdentity } from './dev-identities.js';

/** The same provenance actor seed.ts uses. */
const SEED_ACTOR = '00000000-0000-4000-8000-00000000f00d';

export async function seedDevIdentities(
  prisma: PrismaClient,
  identities: readonly DevIdentity[] = DEV_IDENTITIES,
): Promise<number> {
  for (const who of identities) {
    // One transaction per person, tenant context first — the contract the production client
    // enforces, so RLS is exercised rather than bypassed.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${DEV_TENANT_ID}, true)`;
      await tx.$executeRaw`SELECT set_config('app.actor_id', ${SEED_ACTOR}, true)`;
      await tx.userAccount.upsert({
        where: { id: who.accountId },
        update: {},
        create: {
          id: who.accountId,
          tenantId: DEV_TENANT_ID,
          subject: who.subject,
          email: who.email,
          displayName: who.displayName,
          createdBy: SEED_ACTOR,
        },
      });
      await tx.roleAssignment.upsert({
        where: { id: who.roleAssignmentId },
        update: {},
        create: {
          id: who.roleAssignmentId,
          tenantId: DEV_TENANT_ID,
          userAccountId: who.accountId,
          role: who.role,
          createdBy: SEED_ACTOR,
        },
      });
    });
  }
  return identities.length;
}

async function main(): Promise<void> {
  const prisma = createPrismaClient(loadDatabaseUrl());
  try {
    const count = await seedDevIdentities(prisma);
    console.log(`seeded ${count} dev accounts with role assignments`);
  } finally {
    await prisma.$disconnect();
  }
}

// Only run when invoked directly, so importing this module for tests does not seed.
if (process.argv[1]?.endsWith('seed-dev-identities.ts') === true) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
