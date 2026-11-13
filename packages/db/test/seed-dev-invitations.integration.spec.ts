// The dev invitee against a real Postgres (OQ-033 step 8): the seed makes an invitation and NO account, and the
// first sign-in then takes the real accept path. Connects as `app_rw` for everything the application would do.

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DEV_IDENTITIES, DEV_INVITEES, DEV_TENANT_ID } from '../prisma/dev-identities.js';
import { seedDevIdentities } from '../prisma/seed-dev-identities.js';
import { seedDevInvitations } from '../prisma/seed-dev-invitations.js';
import { acceptInvitation } from '../src/provisioning.js';
import { findActiveUserAccountId } from '../src/user-account.js';
import { hasActiveRoleAssignment } from '../src/roles.js';
import { asTenant, startTestDatabase, type TestDatabase } from './support/database.js';

const ACTOR = '00000000-0000-4000-8000-00000000f00d';
const NOW = new Date('2026-11-13T08:00:00.000Z');
const invitee = DEV_INVITEES[0];
if (invitee === undefined) throw new Error('fixture missing');

let db: TestDatabase;
let migrator: PrismaClient;
let appRw: PrismaClient;

beforeAll(async () => {
  db = await startTestDatabase();
  migrator = db.clientFor('migrator');
  appRw = db.clientFor('app_rw');
  // What `db:seed` does for the dev school, which both seeds need to exist.
  await asTenant(migrator, DEV_TENANT_ID, ACTOR, (tx) =>
    tx.tenant.create({
      data: { id: DEV_TENANT_ID, name: 'Dev School', slug: 'dev-school', kind: 'SCHOOL' },
    }),
  );
}, 180_000);

afterAll(async () => {
  await db?.stop();
});

const inDev = <T>(fn: Parameters<typeof asTenant<T>>[3]) =>
  asTenant(appRw, DEV_TENANT_ID, ACTOR, fn);
const invitationOf = () =>
  inDev((tx) =>
    tx.userInvitation.findFirstOrThrow({ where: { id: invitee.invitationId } }),
  );

describe('seedDevInvitations (real Postgres)', () => {
  it('creates a pending invitation for the invitee and no account', async () => {
    expect(await seedDevInvitations(migrator, DEV_INVITEES, NOW)).toBe(
      DEV_INVITEES.length,
    );
    expect(await invitationOf()).toMatchObject({
      status: 'PENDING',
      email: invitee.email,
      roles: [...invitee.roles],
      confirmation: 'NOT_REQUIRED',
      createdBy: null,
    });
    expect(
      await inDev((tx) => findActiveUserAccountId(tx as never, invitee.subject)),
    ).toBeNull();
    expect(
      await inDev((tx) => tx.userAccount.count({ where: { email: invitee.email } })),
    ).toBe(0);
  });

  it('is idempotent: a second run changes nothing', async () => {
    await seedDevInvitations(migrator, DEV_INVITEES, NOW);
    expect(
      await inDev((tx) => tx.userInvitation.count({ where: { email: invitee.email } })),
    ).toBe(1);
  });

  it('does not make an account when the identities are seeded as well', async () => {
    await seedDevIdentities(migrator);
    expect(await inDev((tx) => tx.userAccount.count())).toBe(DEV_IDENTITIES.length);
    expect(
      await inDev((tx) => findActiveUserAccountId(tx as never, invitee.subject)),
    ).toBeNull();
  });

  it('an address the provider has not verified links nothing, and the invitation stays pending', async () => {
    const refused = await inDev((tx) =>
      acceptInvitation(tx, {
        subject: invitee.subject,
        email: invitee.email,
        emailVerified: false,
        displayName: invitee.displayName,
        now: NOW,
      }),
    );
    expect(refused).toEqual({ ok: false, reason: 'email_not_verified' });
    expect(
      await inDev((tx) => findActiveUserAccountId(tx as never, invitee.subject)),
    ).toBeNull();
    expect(await invitationOf()).toMatchObject({ status: 'PENDING' });
  });

  it('the first sign-in takes the real path: the account and its role are created, the invitation is spent', async () => {
    const result = await inDev((tx) =>
      acceptInvitation(tx, {
        subject: invitee.subject,
        email: invitee.email,
        emailVerified: true,
        displayName: invitee.displayName,
        now: NOW,
      }),
    );
    expect(result).toMatchObject({ ok: true, outcome: 'linked' });
    if (!result.ok) return;
    expect(
      await inDev((tx) => findActiveUserAccountId(tx as never, invitee.subject)),
    ).toBe(result.accountId);
    for (const role of invitee.roles) {
      expect(
        await inDev((tx) =>
          hasActiveRoleAssignment(tx as never, result.accountId, role, NOW),
        ),
      ).toBe(true);
    }
    expect(await invitationOf()).toMatchObject({
      status: 'ACCEPTED',
      acceptedAccountId: result.accountId,
    });
  });

  it('never reopens a spent invitation when seeded again', async () => {
    await seedDevInvitations(migrator, DEV_INVITEES, NOW);
    expect(await invitationOf()).toMatchObject({ status: 'ACCEPTED' });
    expect(
      await inDev((tx) =>
        tx.userInvitation.count({ where: { status: 'PENDING', email: invitee.email } }),
      ),
    ).toBe(0);
  });
});
