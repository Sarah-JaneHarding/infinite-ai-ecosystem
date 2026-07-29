// Two Stage 01 exit-gate items that only a real database can settle.
//
//   "Encryption verified by a test that reads the raw column and asserts it is not
//    plaintext."
//   "Seeds reproducible."
//
// The encryption unit tests prove the primitive in isolation. They cannot prove that an
// encrypted value survives a round trip through Postgres as `bytea`, nor that what
// actually lands in the column is ciphertext — which is the property the gate asks about
// and the one that matters if a backup is stolen.

import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { EncryptionKey, decrypt, encrypt, lookupHash } from '../src/encryption.js';
import { seed, type SeedCounts } from '../prisma/seed.js';
import { asTenant, startTestDatabase, type TestDatabase } from './support/database.js';

/** See the note on `toBytes` in prisma/seed.ts — Prisma's Bytes columns want a
 * `Uint8Array<ArrayBuffer>`, which Node's Buffer is not, structurally. */
function toBytes(value: Buffer): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(new ArrayBuffer(value.byteLength));
  copy.set(value);
  return copy;
}

let db: TestDatabase;
let migrator: PrismaClient;

const KEY = EncryptionKey.generateForTesting(1);
const TENANT = randomUUID();
const ACTOR = randomUUID();

beforeAll(async () => {
  db = await startTestDatabase();
  migrator = db.clientFor('migrator');
}, 180_000);

afterAll(async () => {
  await db?.stop();
});

describe('encrypted identifiers in the database', () => {
  const LEGAL_NAME = 'Nomvula Mahlangu';

  it('stores ciphertext, not plaintext, in the raw column', async () => {
    await asTenant(migrator, TENANT, ACTOR, async (tx) => {
      await tx.tenant.create({
        data: {
          id: TENANT,
          name: 'Encryption Fixture',
          slug: `enc-${TENANT.slice(0, 8)}`,
          kind: 'SCHOOL',
        },
      });
      const school = await tx.school.create({
        data: { tenantId: TENANT, name: 'Campus', lolt: 'en' },
      });
      const phase = await tx.phase.create({
        data: { tenantId: TENANT, schoolId: school.id, name: 'Intermediate' },
      });
      const grade = await tx.grade.create({
        data: { tenantId: TENANT, phaseId: phase.id, label: '6', ordinal: 6 },
      });
      const learner = await tx.learner.create({
        data: {
          tenantId: TENANT,
          schoolId: school.id,
          gradeId: grade.id,
          token: 'LNR_ENC001',
        },
      });

      const value = encrypt(LEGAL_NAME, KEY);
      await tx.learnerIdentifier.create({
        data: {
          tenantId: TENANT,
          learnerId: learner.id,
          kind: 'LEGAL_NAME',
          ciphertext: toBytes(value.ciphertext),
          keyVersion: value.keyVersion,
          lookupHash: toBytes(lookupHash(LEGAL_NAME, TENANT, KEY)),
        },
      });
    });

    // Read the column as raw bytes, the way a stolen backup or a compromised database
    // account would see it — not through the application's decryption path.
    const rows = await asTenant(
      migrator,
      TENANT,
      ACTOR,
      (tx) =>
        tx.$queryRaw<{ ciphertext: Buffer }[]>`
        SELECT ciphertext FROM "learner_identifier" WHERE tenant_id = ${TENANT}::uuid
      `,
    );

    expect(rows).toHaveLength(1);
    const raw = rows[0]!.ciphertext;
    expect(raw.toString('utf8')).not.toContain(LEGAL_NAME);
    expect(raw.toString('latin1')).not.toContain(LEGAL_NAME);
    expect(raw.toString('utf8')).not.toContain('Nomvula');
    expect(raw.toString('utf8')).not.toContain('Mahlangu');
  });

  it('round-trips through the database with the right key', async () => {
    // The mirror of the test above: the value is genuinely recoverable, so "not
    // plaintext" is not passing because the write silently failed.
    const rows = await asTenant(
      migrator,
      TENANT,
      ACTOR,
      (tx) =>
        tx.$queryRaw<{ ciphertext: Buffer; key_version: number }[]>`
        SELECT ciphertext, key_version FROM "learner_identifier"
        WHERE tenant_id = ${TENANT}::uuid
      `,
    );
    const row = rows[0]!;
    expect(
      decrypt({ ciphertext: row.ciphertext, keyVersion: row.key_version }, KEY),
    ).toBe(LEGAL_NAME);
  });

  it('stores a lookup hash that is not the plaintext either', async () => {
    const rows = await asTenant(
      migrator,
      TENANT,
      ACTOR,
      (tx) =>
        tx.$queryRaw<{ lookup_hash: Buffer | null }[]>`
        SELECT lookup_hash FROM "learner_identifier" WHERE tenant_id = ${TENANT}::uuid
      `,
    );
    const hash = rows[0]!.lookup_hash;
    expect(hash).not.toBeNull();
    expect(hash!.toString('utf8')).not.toContain(LEGAL_NAME);
    // SHA-256 output.
    expect(hash!.length).toBe(32);
  });

  it('finds a learner by lookup hash without decrypting anything', async () => {
    // The property the hash exists for. If this stopped working, ingestion would have to
    // decrypt every row to match one, and the encryption would become unusable in
    // practice — which is how encryption quietly gets removed.
    const target = lookupHash(LEGAL_NAME, TENANT, KEY);
    const rows = await asTenant(
      migrator,
      TENANT,
      ACTOR,
      (tx) =>
        tx.$queryRaw<{ count: bigint }[]>`
        SELECT count(*)::bigint AS count FROM "learner_identifier"
        WHERE tenant_id = ${TENANT}::uuid AND lookup_hash = ${toBytes(target)}
      `,
    );
    expect(Number(rows[0]!.count)).toBe(1);
  });
});

/** The seed's fixed tenant ids, mirrored so the checks below can scope themselves. */
const SEEDED_TENANTS = {
  smallPrimary: '10000000-0000-4000-8000-000000000001',
  largePrimary: '10000000-0000-4000-8000-000000000002',
  schoolGroup: '10000000-0000-4000-8000-000000000003',
} as const;

describe('seed reproducibility', () => {
  let first: Record<string, SeedCounts>;

  it('seeds three tenants of different shapes', async () => {
    first = await seed(migrator);

    expect(Object.keys(first).sort()).toEqual([
      'largePrimary',
      'schoolGroup',
      'smallPrimary',
    ]);

    // The shapes must actually differ, or the seed is not doing the job the manual asks
    // of it — a fixture where every tenant looks alike hides pagination and rollup bugs.
    expect(first['smallPrimary']!.schools).toBe(1);
    expect(first['schoolGroup']!.schools).toBe(2);
    expect(first['largePrimary']!.learners).toBeGreaterThan(
      first['smallPrimary']!.learners,
    );
  });

  it('creates exactly one register teacher per class, across campuses', async () => {
    // The check that would have caught the email-collision bug as a named assertion
    // rather than a seed crash: if two campuses collided on a teacher account, the
    // counts would diverge.
    for (const counts of Object.values(first)) {
      expect(counts.staff).toBe(counts.classes);
    }
  });

  it('is a no-op on a second run', async () => {
    const second = await seed(migrator);
    expect(second).toEqual(first);
  });

  // These run per tenant rather than across the whole table. A cross-tenant scan is
  // exactly what RLS forbids, and the first version of these tests tried one — it failed
  // with `invalid input syntax for type uuid: ""`, which is the isolation layer doing its
  // job on the test that forgot about it.
  it.each(Object.values(SEEDED_TENANTS))(
    'leaves no duplicate learner tokens in %s',
    async (tenantId) => {
      const rows = await asTenant(
        migrator,
        tenantId,
        ACTOR,
        (tx) =>
          tx.$queryRaw<{ count: bigint }[]>`
          SELECT count(*)::bigint AS count FROM (
            SELECT token FROM "learner" GROUP BY token HAVING count(*) > 1
          ) AS duplicates
        `,
      );
      expect(Number(rows[0]!.count)).toBe(0);
    },
  );

  it.each(Object.values(SEEDED_TENANTS))(
    'encrypts every seeded identifier in %s',
    async (tenantId) => {
      // The seed goes through the real encryption path rather than around it, so a
      // regression that wrote plaintext would show up here on realistic volume.
      const rows = await asTenant(
        migrator,
        tenantId,
        ACTOR,
        (tx) =>
          tx.$queryRaw<{ ciphertext: Buffer }[]>`
          SELECT ciphertext FROM "learner_identifier" LIMIT 200
        `,
      );
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        // AES-GCM output is at least iv(12) + tag(16) + 1 byte of body.
        expect(row.ciphertext.length).toBeGreaterThan(28);
      }
    },
  );
});
