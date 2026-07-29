// Stage 03's database-side guarantees, against a real Postgres.
//
// Three of them cannot be established any other way:
//
//   1. The consent ledger is append-only *because the database refuses*, not because the
//      application declines to offer an update. A trigger either fires or it does not, and
//      only a live server can say which.
//   2. Erasure destroys the encrypted identifier rows and leaves the decision record
//      standing. That is a claim about what remains in the tables afterwards.
//   3. The new POPIA tables are isolated by tenant like every other table. The Stage 01
//      suite covers the tables that existed then; these three arrived afterwards, and a
//      table whose RLS policy was forgotten looks exactly like one whose policy works
//      until someone from another school reads it.
//
// Everything here connects as `app_rw`. A superuser bypasses RLS entirely and a suite
// written against one would pass while proving nothing.

import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { appendConsentEntry, readLedger, readTenantLedger } from '../src/consent.js';
import { EncryptionKey, encrypt } from '../src/encryption.js';
import { eraseSubject } from '../src/erasure.js';
import { APPEND_ONLY_TABLES } from '../src/tables.js';
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
const TENANT_A = randomUUID();
const TENANT_B = randomUUID();
const ACTOR = randomUUID();
const NOW = new Date('2026-06-01T09:00:00.000Z');

interface Fixture {
  learnerToken: string;
  guardianToken: string;
}

const fixtures = new Map<string, Fixture>();

async function createTenant(tenantId: string, label: string): Promise<Fixture> {
  const learnerToken = `LNR_${tenantId.replace(/-/g, '').slice(0, 12).toUpperCase()}`;
  const guardianToken = `GDN_${tenantId.replace(/-/g, '').slice(0, 12).toUpperCase()}`;

  await asTenant(migrator, tenantId, ACTOR, async (tx) => {
    await tx.tenant.create({
      data: {
        id: tenantId,
        name: label,
        slug: `popia-${tenantId.slice(0, 8)}`,
        kind: 'SCHOOL',
      },
    });
    const school = await tx.school.create({
      data: { tenantId, name: `${label} Campus`, lolt: 'en' },
    });
    const phase = await tx.phase.create({
      data: { tenantId, schoolId: school.id, name: 'Foundation Phase' },
    });
    const grade = await tx.grade.create({
      data: { tenantId, phaseId: phase.id, label: 'Grade 3', ordinal: 3 },
    });
    const learner = await tx.learner.create({
      data: {
        tenantId,
        schoolId: school.id,
        gradeId: grade.id,
        token: learnerToken,
        homeLanguage: 'isiZulu',
      },
    });
    // Two encrypted identifiers, so the erasure test has something real to destroy.
    for (const [kind, plaintext] of [
      ['LEGAL_NAME', 'Nomvula Mahlangu'],
      ['DATE_OF_BIRTH', '2017-04-11'],
    ] as const) {
      const { ciphertext, keyVersion } = encrypt(plaintext, KEY);
      await tx.learnerIdentifier.create({
        data: {
          tenantId,
          learnerId: learner.id,
          kind,
          ciphertext: toBytes(ciphertext),
          keyVersion,
        },
      });
    }
    const guardian = await tx.guardian.create({
      data: { tenantId, token: guardianToken, homeLanguage: 'isiZulu' },
    });
    await tx.guardianLink.create({
      data: {
        tenantId,
        guardianId: guardian.id,
        learnerId: learner.id,
        relationship: 'mother',
        isPrimary: true,
      },
    });
  });

  return { learnerToken, guardianToken };
}

beforeAll(async () => {
  db = await startTestDatabase();
  migrator = db.clientFor('migrator');
  appRw = db.clientFor('app_rw');
  fixtures.set(TENANT_A, await createTenant(TENANT_A, 'Kleinbos Primary'));
  fixtures.set(TENANT_B, await createTenant(TENANT_B, 'Thabo Mbeki Primary'));
}, 300_000);

afterAll(async () => {
  await db?.stop();
});

function fixture(tenantId: string): Fixture {
  const found = fixtures.get(tenantId);
  if (found === undefined) throw new Error(`No fixture for ${tenantId}`);
  return found;
}

describe('the consent ledger is append-only, enforced by the database', () => {
  it('names the tables it claims to protect', () => {
    // Table-driven off the exported constant, so a fourth ledger added without a trigger
    // fails here rather than passing unnoticed.
    expect([...APPEND_ONLY_TABLES]).toEqual(['audit_event', 'consent_record']);
  });

  it('accepts an append', async () => {
    const row = await asTenant(appRw, TENANT_A, ACTOR, (tx) =>
      appendConsentEntry(
        tx,
        {
          subjectToken: fixture(TENANT_A).learnerToken,
          category: 'ACADEMIC_PERFORMANCE',
          purpose: 'screening',
          basis: 'CONSENT',
          decision: 'GRANTED',
          source: 'PAPER_FORM',
          evidenceRef: 'admission-form-2026/0431',
          effectiveFrom: new Date('2026-01-15T08:00:00.000Z'),
          recordedBy: null,
          note: null,
        },
        NOW,
      ),
    );
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(row.recordedAt.toISOString()).toBe(NOW.toISOString());
  });

  it('refuses an UPDATE, as app_rw', async () => {
    await expect(
      asTenant(
        appRw,
        TENANT_A,
        ACTOR,
        (tx) => tx.$executeRaw`UPDATE consent_record SET decision = 'WITHDRAWN'`,
      ),
    ).rejects.toThrow(/append-only/i);
  });

  it('refuses a DELETE, as app_rw', async () => {
    await expect(
      asTenant(
        appRw,
        TENANT_A,
        ACTOR,
        (tx) => tx.$executeRaw`DELETE FROM consent_record`,
      ),
    ).rejects.toThrow(/append-only/i);
  });

  it('refuses an UPDATE as migrator too, which owns the table', async () => {
    // The role that could otherwise tidy the ledger is the one it most needs to bind.
    await expect(
      asTenant(
        migrator,
        TENANT_A,
        ACTOR,
        (tx) => tx.$executeRaw`UPDATE consent_record SET note = 'tidied'`,
      ),
    ).rejects.toThrow(/append-only/i);
  });

  it('records a withdrawal as a new row rather than a change to the old one', async () => {
    await asTenant(appRw, TENANT_A, ACTOR, (tx) =>
      appendConsentEntry(
        tx,
        {
          subjectToken: fixture(TENANT_A).learnerToken,
          category: 'ACADEMIC_PERFORMANCE',
          purpose: 'screening',
          basis: 'CONSENT',
          decision: 'WITHDRAWN',
          source: 'GUARDIAN_PORTAL',
          evidenceRef: null,
          effectiveFrom: new Date('2026-03-01T00:00:00.000Z'),
          recordedBy: null,
          note: null,
        },
        NOW,
      ),
    );
    const ledger = await asTenant(appRw, TENANT_A, ACTOR, (tx) =>
      readLedger(tx, fixture(TENANT_A).learnerToken),
    );
    expect(ledger.map((row) => row.decision)).toEqual(['GRANTED', 'WITHDRAWN']);
  });

  it('returns the ledger oldest first, whatever order rows were written in', async () => {
    // A backdated capture, written third, must read second.
    await asTenant(appRw, TENANT_A, ACTOR, (tx) =>
      appendConsentEntry(
        tx,
        {
          subjectToken: fixture(TENANT_A).learnerToken,
          category: 'ATTENDANCE',
          purpose: 'screening',
          basis: 'PUBLIC_LAW_DUTY',
          decision: 'GRANTED',
          source: 'NOT_APPLICABLE',
          evidenceRef: null,
          effectiveFrom: new Date('2025-06-01T00:00:00.000Z'),
          recordedBy: null,
          note: null,
        },
        NOW,
      ),
    );
    const ledger = await asTenant(appRw, TENANT_A, ACTOR, (tx) =>
      readLedger(tx, fixture(TENANT_A).learnerToken),
    );
    const dates = ledger.map((row) => row.effectiveFrom.getTime());
    expect([...dates].sort((a, b) => a - b)).toEqual(dates);
  });

  it('refuses an entry with no subject', async () => {
    // A ledger row that names nobody is a row nobody can ever act on, and it cannot be
    // deleted afterwards.
    await expect(
      asTenant(appRw, TENANT_A, ACTOR, (tx) =>
        appendConsentEntry(
          tx,
          {
            subjectToken: '   ',
            category: 'ATTENDANCE',
            purpose: 'screening',
            basis: 'PUBLIC_LAW_DUTY',
            decision: 'GRANTED',
            source: 'NOT_APPLICABLE',
            evidenceRef: null,
            effectiveFrom: new Date('2026-01-15T08:00:00.000Z'),
            recordedBy: null,
            note: null,
          },
          NOW,
        ),
      ),
    ).rejects.toThrow(/no subject/i);
  });

  it('refuses a future-dated entry before it reaches the table', async () => {
    await expect(
      asTenant(appRw, TENANT_A, ACTOR, (tx) =>
        appendConsentEntry(
          tx,
          {
            subjectToken: fixture(TENANT_A).learnerToken,
            category: 'ATTENDANCE',
            purpose: 'screening',
            basis: 'CONSENT',
            decision: 'GRANTED',
            source: 'PAPER_FORM',
            evidenceRef: 'form/9',
            effectiveFrom: new Date('2027-01-01T00:00:00.000Z'),
            recordedBy: null,
            note: null,
          },
          NOW,
        ),
      ),
    ).rejects.toThrow(/future-dated/i);
  });
});

describe('the POPIA tables are tenant-isolated', () => {
  it('does not show tenant A`s consent ledger to tenant B', async () => {
    const seen = await asTenant(appRw, TENANT_B, ACTOR, (tx) => readTenantLedger(tx));
    const foreign = seen.filter(
      (row) => row.subjectToken === fixture(TENANT_A).learnerToken,
    );
    expect(foreign).toEqual([]);
  });

  it('refuses an insert carrying another tenant`s id', async () => {
    await expect(
      asTenant(appRw, TENANT_B, ACTOR, (tx) =>
        tx.consentRecord.create({
          data: {
            tenantId: TENANT_A,
            subjectToken: fixture(TENANT_A).learnerToken,
            category: 'ATTENDANCE',
            purpose: 'screening',
            basis: 'PUBLIC_LAW_DUTY',
            decision: 'GRANTED',
            source: 'NOT_APPLICABLE',
            evidenceRef: null,
            effectiveFrom: NOW,
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it('isolates retention rules', async () => {
    await asTenant(appRw, TENANT_A, ACTOR, (tx) =>
      tx.retentionRule.create({
        data: {
          tenantId: TENANT_A,
          category: 'ATTENDANCE',
          anchor: 'ACADEMIC_YEAR_END',
          retainMonths: 60,
          authority: 'Governing body resolution 2026/04, minuted 2026-04-18',
          ratifiedAt: new Date('2026-04-18T00:00:00.000Z'),
          ratifiedBy: 'Kleinbos Primary SGB',
        },
      }),
    );
    const fromB = await asTenant(appRw, TENANT_B, ACTOR, (tx) =>
      tx.retentionRule.findMany(),
    );
    expect(fromB).toEqual([]);
  });

  it('isolates data subject requests', async () => {
    await asTenant(appRw, TENANT_A, ACTOR, (tx) =>
      tx.dataSubjectRequest.create({
        data: {
          tenantId: TENANT_A,
          subjectToken: fixture(TENANT_A).learnerToken,
          kind: 'ACCESS',
          detail: 'What do you hold about my child?',
          dueAt: new Date('2026-07-01T00:00:00.000Z'),
        },
      }),
    );
    const fromB = await asTenant(appRw, TENANT_B, ACTOR, (tx) =>
      tx.dataSubjectRequest.findMany(),
    );
    expect(fromB).toEqual([]);
  });

  it('refuses a query with no tenant context', async () => {
    await expect(appRw.consentRecord.findMany()).rejects.toThrow();
  });
});

describe('erasure destroys the identifiers and keeps the decision record', () => {
  it('gives the subject a consent history to survive the erasure', async () => {
    // Tenant B has had no ledger entries until now; every append above was to tenant A.
    // Without this the "ledger survives" case below would attempt a DELETE that RLS
    // filters to zero rows, the trigger would never fire, nothing would throw, and the
    // test would fail while appearing to assert something. Worse, had it been written as
    // a bare `resolves`, it would have *passed* while proving nothing at all.
    await asTenant(appRw, TENANT_B, ACTOR, (tx) =>
      appendConsentEntry(
        tx,
        {
          subjectToken: fixture(TENANT_B).learnerToken,
          category: 'ATTENDANCE',
          purpose: 'screening',
          basis: 'PUBLIC_LAW_DUTY',
          decision: 'GRANTED',
          source: 'NOT_APPLICABLE',
          evidenceRef: null,
          effectiveFrom: new Date('2026-01-15T08:00:00.000Z'),
          recordedBy: null,
          note: null,
        },
        NOW,
      ),
    );
    const ledger = await asTenant(appRw, TENANT_B, ACTOR, (tx) =>
      readLedger(tx, fixture(TENANT_B).learnerToken),
    );
    expect(ledger).toHaveLength(1);
  });

  it('erases a learner', async () => {
    const token = fixture(TENANT_B).learnerToken;
    const before = await asTenant(appRw, TENANT_B, ACTOR, (tx) =>
      tx.learnerIdentifier.count(),
    );
    expect(before).toBe(2);

    const outcome = await asTenant(appRw, TENANT_B, ACTOR, (tx) =>
      eraseSubject(tx, {
        subjectKind: 'learner',
        subjectToken: token,
        trigger: 'subject_request',
        requestId: null,
        now: NOW,
      }),
    );

    expect(outcome.changed).toBe(true);
    expect(outcome.identifiersDestroyed).toBe(2);

    const after = await asTenant(appRw, TENANT_B, ACTOR, async (tx) => ({
      identifiers: await tx.learnerIdentifier.count(),
      learner: await tx.learner.findFirst({ where: { token } }),
      links: await tx.guardianLink.count(),
    }));

    // Gone: every encrypted identifier. Deleted rather than tombstoned — a tombstoned
    // ciphertext is still a decryptable ciphertext for anyone holding the key.
    expect(after.identifiers).toBe(0);
    // Standing: the learner row, its token, its enrolment, and the guardian link. The
    // school can still say what it did; it can no longer say to whom.
    expect(after.learner?.tombstonedAt?.toISOString()).toBe(NOW.toISOString());
    expect(after.learner?.token).toBe(token);
    expect(after.learner?.homeLanguage).toBeNull();
    expect(after.links).toBe(1);
  });

  it('writes an audit event naming the trigger', async () => {
    const events = await asTenant(appRw, TENANT_B, ACTOR, (tx) =>
      tx.auditEvent.findMany({ where: { action: 'subject_erasure' } }),
    );
    expect(events.length).toBeGreaterThan(0);
    const diff = events[0]?.diff as Record<string, unknown>;
    expect(diff['trigger']).toBe('subject_request');
    // Counts and flags, never values. An audit trail that recorded what was erased would
    // be a copy of the erased data with a longer retention period than the record it
    // replaced.
    expect(JSON.stringify(diff)).not.toContain('Nomvula');
  });

  it('is idempotent', async () => {
    const outcome = await asTenant(appRw, TENANT_B, ACTOR, (tx) =>
      eraseSubject(tx, {
        subjectKind: 'learner',
        subjectToken: fixture(TENANT_B).learnerToken,
        trigger: 'retention_expiry',
        requestId: null,
        now: new Date('2026-08-01T00:00:00.000Z'),
      }),
    );
    expect(outcome.changed).toBe(false);
    expect(outcome.identifiersDestroyed).toBe(0);
    // The original tombstone stands. A retry must not rewrite when the erasure happened.
    expect(outcome.tombstonedAt.toISOString()).toBe(NOW.toISOString());
  });

  it('refuses to report an erasure of a subject it cannot see', async () => {
    // Tenant A's learner, addressed from tenant B. RLS makes it invisible; the erasure
    // must fail rather than return a cheerful zero-count success.
    await expect(
      asTenant(appRw, TENANT_B, ACTOR, (tx) =>
        eraseSubject(tx, {
          subjectKind: 'learner',
          subjectToken: fixture(TENANT_A).learnerToken,
          trigger: 'subject_request',
          requestId: null,
          now: NOW,
        }),
      ),
    ).rejects.toThrow(/Refusing to report an erasure that did not happen/);
  });

  it('erases a guardian and stops their reports', async () => {
    const outcome = await asTenant(appRw, TENANT_B, ACTOR, (tx) =>
      eraseSubject(tx, {
        subjectKind: 'guardian',
        subjectToken: fixture(TENANT_B).guardianToken,
        trigger: 'consent_withdrawal',
        requestId: null,
        now: NOW,
      }),
    );
    expect(outcome.changed).toBe(true);

    const links = await asTenant(appRw, TENANT_B, ACTOR, (tx) =>
      tx.guardianLink.findMany(),
    );
    // The link survives — a report sent last term still has to be explicable — but the
    // right to be sent another does not.
    expect(links).toHaveLength(1);
    expect(links[0]?.mayReceiveReports).toBe(false);
  });

  it('leaves the erased learner`s consent ledger intact', async () => {
    // POPIA §24 does not entitle a subject to erase the school's record of its own lawful
    // acts, and the ledger is exactly that record.
    const ledger = await asTenant(appRw, TENANT_B, ACTOR, (tx) =>
      readLedger(tx, fixture(TENANT_B).learnerToken),
    );
    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.category).toBe('ATTENDANCE');

    // It is also, by construction, unerasable: the trigger refuses DELETE. The row above
    // is what makes this a real attempt rather than a no-op RLS filtered to nothing.
    await expect(
      asTenant(
        appRw,
        TENANT_B,
        ACTOR,
        (tx) => tx.$executeRaw`DELETE FROM consent_record`,
      ),
    ).rejects.toThrow(/append-only/i);
  });

  it('refuses an empty subject token', async () => {
    await expect(
      asTenant(appRw, TENANT_B, ACTOR, (tx) =>
        eraseSubject(tx, {
          subjectKind: 'learner',
          subjectToken: '   ',
          trigger: 'subject_request',
          requestId: null,
          now: NOW,
        }),
      ),
    ).rejects.toThrow(/empty subject token/i);
  });

  it('is idempotent for a guardian too', async () => {
    // The learner path has this covered above. The guardian path is a separate branch and
    // was not exercised by anything — a retention sweep retrying a guardian erasure would
    // have been running untested code.
    const outcome = await asTenant(appRw, TENANT_B, ACTOR, (tx) =>
      eraseSubject(tx, {
        subjectKind: 'guardian',
        subjectToken: fixture(TENANT_B).guardianToken,
        trigger: 'retention_expiry',
        requestId: null,
        now: new Date('2026-09-01T00:00:00.000Z'),
      }),
    );
    expect(outcome.changed).toBe(false);
    expect(outcome.tombstonedAt.toISOString()).toBe(NOW.toISOString());
  });

  it('refuses to erase a guardian that is not there', async () => {
    // Same rule as the learner case, and worth its own assertion: a retention sweep must
    // never be able to report having erased a subject it never touched.
    await expect(
      asTenant(appRw, TENANT_B, ACTOR, (tx) =>
        eraseSubject(tx, {
          subjectKind: 'guardian',
          subjectToken: 'GDN_000000000000',
          trigger: 'retention_expiry',
          requestId: null,
          now: NOW,
        }),
      ),
    ).rejects.toThrow(/Refusing to report an erasure that did not happen/);
  });
});

describe('neither path works without a tenant context', () => {
  // Rule 5 at the two entry points this stage added. Both call `current_setting` and
  // refuse without one — the assertion is that they reject, not what they say, because a
  // connection that has previously carried a context reads `''` and one that never has
  // raises, and both are correct failures. Stage 01 recorded that finding.

  it('refuses to append a consent entry', async () => {
    await expect(
      appRw.$transaction((tx) =>
        appendConsentEntry(
          tx,
          {
            subjectToken: fixture(TENANT_A).learnerToken,
            category: 'ATTENDANCE',
            purpose: 'screening',
            basis: 'PUBLIC_LAW_DUTY',
            decision: 'GRANTED',
            source: 'NOT_APPLICABLE',
            evidenceRef: null,
            effectiveFrom: new Date('2026-01-15T08:00:00.000Z'),
            recordedBy: null,
            note: null,
          },
          NOW,
        ),
      ),
    ).rejects.toThrow();
  });

  it('refuses to erase a subject', async () => {
    await expect(
      appRw.$transaction((tx) =>
        eraseSubject(tx, {
          subjectKind: 'learner',
          subjectToken: fixture(TENANT_A).learnerToken,
          trigger: 'subject_request',
          requestId: null,
          now: NOW,
        }),
      ),
    ).rejects.toThrow();
  });
});
