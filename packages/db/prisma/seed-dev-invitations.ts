// Seeds a pending invitation for each dev invitee — development only (OQ-033 step 8).
//
// `pnpm --filter @infinite-ai/db db:seed:invitations`, after `db:seed` (the tenant must exist). Run it as the
// migrator, like the other seeds. Idempotent: the write is an upsert on a fixed id with an empty update, so a
// second run changes nothing — in particular it never reopens an invitation that has been accepted, revoked or
// has expired. To try the flow again, reset the dev database (`pnpm sandbox reset`).
//
// No account is created here, by design: the point is that the first sign-in creates it through the real
// accept path. Invented fixture data throughout (example.invalid, no real person, no secret).

import { loadDatabaseUrl } from '@infinite-ai/config';
import type { PrismaClient } from '@prisma/client';

import { createPrismaClient } from '../src/client.js';

import { DEV_INVITEES, DEV_TENANT_ID, type DevInvitee } from './dev-identities.js';

/** The same provenance actor seed.ts uses. */
const SEED_ACTOR = '00000000-0000-4000-8000-00000000f00d';
const LIFETIME_DAYS = 365;

export async function seedDevInvitations(
  prisma: PrismaClient,
  invitees: readonly DevInvitee[] = DEV_INVITEES,
  now: Date = new Date(),
): Promise<number> {
  const expiresAt = new Date(now.getTime() + LIFETIME_DAYS * 24 * 60 * 60 * 1000);
  for (const who of invitees) {
    // Tenant context first, as the production client does, so RLS is exercised rather than bypassed.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${DEV_TENANT_ID}, true)`;
      await tx.$executeRaw`SELECT set_config('app.actor_id', ${SEED_ACTOR}, true)`;
      await tx.userInvitation.upsert({
        where: { id: who.invitationId },
        update: {},
        create: {
          id: who.invitationId,
          tenantId: DEV_TENANT_ID,
          email: who.email,
          roles: [...who.roles],
          status: 'PENDING',
          expiresAt,
          // An operator-created (bootstrap) invitation has no inviting administrator.
          createdBy: null,
        },
      });
    });
  }
  return invitees.length;
}

async function main(): Promise<void> {
  const prisma = createPrismaClient(loadDatabaseUrl());
  try {
    const count = await seedDevInvitations(prisma);
    console.log(
      `seeded ${count} dev invitation(s); sign in as the invitee to create the account`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Only run when invoked directly, so importing this module for tests does not seed.
if (process.argv[1]?.endsWith('seed-dev-invitations.ts') === true) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
