// The tenant lexicon, against a real Postgres — Stage 04 step 9's last open dependency.
//
// Three things only a live database can establish: that a learner's legal name comes back
// decrypted correctly from `learner_identifier`, that it is scoped by tenant like every
// other table (RLS, not application discipline), and that a learner whose identifiers were
// destroyed by `eraseSubject` drops out of the lexicon without this function having to
// know why.
//
// Connects as `app_rw`, not the container's superuser — see the note in
// `test/support/database.ts`.

import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { EncryptionKey, encrypt } from '../src/encryption.js';
import { eraseSubject } from '../src/erasure.js';
import { readTenantLexicon } from '../src/lexicon.js';
import { asTenant, startTestDatabase, type TestDatabase } from './support/database.js';

/** See the note on `toBytes` in prisma/seed.ts. */
function toBytes(value: Buffer): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(new ArrayBuffer(value.byteLength));
  copy.set(value);
  return copy;
}

let db: TestDatabase;
let appRw: PrismaClient;
let migrator: PrismaClient;

const KEY = EncryptionKey.generateForTesting(1);
const OTHER_KEY_VERSION_KEY = EncryptionKey.generateForTesting(2);
const TENANT_A = randomUUID();
const TENANT_B = randomUUID();
const ACTOR = randomUUID();

interface Fixture {
  learnerId: string;
  learnerToken: string;
}

async function seedTenant(
  tenantId: string,
  label: string,
  client: PrismaClient,
): Promise<Fixture> {
  const learnerToken = `LNR_${tenantId.replace(/-/g, '').slice(0, 12).toUpperCase()}`;

  const learnerId = await asTenant(client, tenantId, ACTOR, async (tx) => {
    await tx.tenant.create({
      data: {
        id: tenantId,
        name: label,
        slug: `lexicon-${tenantId.slice(0, 8)}`,
        kind: 'SCHOOL',
      },
    });
    const school = await tx.school.create({
      data: { tenantId, name: `${label} Campus`, lolt: 'en' },
    });
    await tx.staffMember.create({
      data: { tenantId, schoolId: school.id, displayName: `${label} Teacher` },
    });
    const phase = await tx.phase.create({
      data: { tenantId, schoolId: school.id, name: 'Foundation Phase' },
    });
    const grade = await tx.grade.create({
      data: { tenantId, phaseId: phase.id, label: 'Grade 3', ordinal: 3 },
    });
    const learner = await tx.learner.create({
      data: { tenantId, schoolId: school.id, gradeId: grade.id, token: learnerToken },
    });

    const legalName = encrypt(`${label} Learner`, KEY);
    await tx.learnerIdentifier.create({
      data: {
        tenantId,
        learnerId: learner.id,
        kind: 'LEGAL_NAME',
        ciphertext: toBytes(legalName.ciphertext),
        keyVersion: legalName.keyVersion,
      },
    });

    // A row encrypted under a key version this test does not hold — must be skipped, not
    // thrown on, so one stale row cannot take down the whole lexicon.
    const staleName = encrypt('Some Other Name', OTHER_KEY_VERSION_KEY);
    await tx.learnerIdentifier.create({
      data: {
        tenantId,
        learnerId: learner.id,
        kind: 'DATE_OF_BIRTH',
        ciphertext: toBytes(staleName.ciphertext),
        keyVersion: staleName.keyVersion,
      },
    });

    return learner.id;
  });

  return { learnerId, learnerToken };
}

let tenantB: Fixture;

beforeAll(async () => {
  db = await startTestDatabase();
  migrator = db.clientFor('migrator');
  appRw = db.clientFor('app_rw');
  await seedTenant(TENANT_A, 'Kleinbos Primary', migrator);
  tenantB = await seedTenant(TENANT_B, 'Riverside Primary', migrator);
}, 300_000);

afterAll(async () => {
  await db?.stop();
});

describe('readTenantLexicon', () => {
  it('returns the tenant’s learner legal name, decrypted, and its staff and school names', async () => {
    const lexicon = await asTenant(appRw, TENANT_A, ACTOR, (tx) =>
      readTenantLexicon(tx, KEY),
    );

    expect(lexicon.personNames).toContain('Kleinbos Primary Learner');
    expect(lexicon.personNames).toContain('Kleinbos Primary Teacher');
    expect(lexicon.schoolNames).toContain('Kleinbos Primary Campus');
  });

  it('never returns another tenant’s names — RLS, not application discipline', async () => {
    const lexicon = await asTenant(appRw, TENANT_A, ACTOR, (tx) =>
      readTenantLexicon(tx, KEY),
    );

    expect(lexicon.personNames).not.toContain('Riverside Primary Learner');
    expect(lexicon.schoolNames).not.toContain('Riverside Primary Campus');
  });

  it('does not throw on an identifier encrypted under a different key version', async () => {
    // The DATE_OF_BIRTH row seeded above is encrypted under OTHER_KEY_VERSION_KEY, not
    // KEY. This resolves at all, which is the assertion — a throw would fail the test.
    await expect(
      asTenant(appRw, TENANT_A, ACTOR, (tx) => readTenantLexicon(tx, KEY)),
    ).resolves.toBeDefined();
  });

  it('drops a learner’s name once eraseSubject has destroyed their identifiers', async () => {
    await asTenant(appRw, TENANT_B, ACTOR, (tx) =>
      eraseSubject(tx, {
        subjectToken: tenantB.learnerToken,
        subjectKind: 'learner',
        trigger: 'retention_expiry',
        requestId: null,
        now: new Date('2026-08-04T09:00:00.000Z'),
      }),
    );

    const lexicon = await asTenant(appRw, TENANT_B, ACTOR, (tx) =>
      readTenantLexicon(tx, KEY),
    );
    expect(lexicon.personNames).not.toContain('Riverside Primary Learner');
    // The staff member is untouched by a learner erasure.
    expect(lexicon.personNames).toContain('Riverside Primary Teacher');
  });

  it('deduplicates a name that appears more than once', async () => {
    const duplicateTenant = randomUUID();
    await asTenant(migrator, duplicateTenant, ACTOR, async (tx) => {
      await tx.tenant.create({
        data: {
          id: duplicateTenant,
          name: 'Dup',
          slug: `lexicon-dup-${duplicateTenant.slice(0, 8)}`,
          kind: 'SCHOOL',
        },
      });
      const school = await tx.school.create({
        data: { tenantId: duplicateTenant, name: 'Dup Campus', lolt: 'en' },
      });
      const phase = await tx.phase.create({
        data: {
          tenantId: duplicateTenant,
          schoolId: school.id,
          name: 'Foundation Phase',
        },
      });
      const grade = await tx.grade.create({
        data: {
          tenantId: duplicateTenant,
          phaseId: phase.id,
          label: 'Grade 3',
          ordinal: 3,
        },
      });
      for (const suffix of ['a', 'b']) {
        const learner = await tx.learner.create({
          data: {
            tenantId: duplicateTenant,
            schoolId: school.id,
            gradeId: grade.id,
            token: `LNR_DUP_${suffix.toUpperCase()}`,
          },
        });
        const legalName = encrypt('Repeated Name', KEY);
        await tx.learnerIdentifier.create({
          data: {
            tenantId: duplicateTenant,
            learnerId: learner.id,
            kind: 'LEGAL_NAME',
            ciphertext: toBytes(legalName.ciphertext),
            keyVersion: legalName.keyVersion,
          },
        });
      }
    });

    const lexicon = await asTenant(appRw, duplicateTenant, ACTOR, (tx) =>
      readTenantLexicon(tx, KEY),
    );
    expect(lexicon.personNames.filter((name) => name === 'Repeated Name')).toHaveLength(
      1,
    );
  });
});
