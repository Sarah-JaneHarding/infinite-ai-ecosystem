// The RLS isolation suite — Stage 01 step 7.
//
// "A Postgres schema where cross-tenant data access is impossible by construction, proven
// by tests that try to break it." This file is the proving. Everything else in Stage 01 is
// a claim until these pass.
//
// Runs against real Postgres via Testcontainers, as `app_rw` — the role the application
// actually uses. See test/support/database.ts for why that matters more than it looks.

import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TENANT_OWNED_TABLES } from '../src/tables.js';
import { asTenant, startTestDatabase, type TestDatabase } from './support/database.js';

let db: TestDatabase;
let appRw: PrismaClient;
let migrator: PrismaClient;

const TENANT_A = randomUUID();
const TENANT_B = randomUUID();
const ACTOR = randomUUID();

/** Ids of the rows seeded for each tenant, keyed by table. */
const rowIds = new Map<string, { a: string; b: string }>();

// Starting a container and running migrations is slow; one instance serves the file.
beforeAll(async () => {
  db = await startTestDatabase();
  migrator = db.clientFor('migrator');
  appRw = db.clientFor('app_rw');
  await seedTwoTenants();
}, 180_000);

afterAll(async () => {
  await db?.stop();
});

/**
 * Creates one row per tenant-owned table for each of two tenants.
 *
 * Seeded through `migrator` with the tenant context set, so the WITH CHECK clause is
 * satisfied honestly rather than by disabling anything.
 */
async function seedTwoTenants(): Promise<void> {
  for (const tenantId of [TENANT_A, TENANT_B]) {
    await asTenant(migrator, tenantId, ACTOR, async (tx) => {
      await tx.tenant.create({
        data: {
          id: tenantId,
          name: `Tenant ${tenantId.slice(0, 8)}`,
          slug: `t-${tenantId.slice(0, 8)}`,
          kind: 'SCHOOL',
        },
      });
    });
  }

  for (const tenantId of [TENANT_A, TENANT_B]) {
    await asTenant(migrator, tenantId, ACTOR, async (tx) => {
      const school = await tx.school.create({
        data: { tenantId, name: 'Main Campus', lolt: 'en' },
      });
      const phase = await tx.phase.create({
        data: { tenantId, schoolId: school.id, name: 'Intermediate' },
      });
      const grade = await tx.grade.create({
        data: { tenantId, phaseId: phase.id, label: '6', ordinal: 6 },
      });
      const classGroup = await tx.classGroup.create({
        data: { tenantId, schoolId: school.id, gradeId: grade.id, name: '6A' },
      });
      const subject = await tx.subject.create({
        data: { tenantId, name: 'Mathematics' },
      });
      const year = await tx.academicYear.create({
        data: {
          tenantId,
          schoolId: school.id,
          year: 2026,
          startsOn: new Date('2026-01-14'),
          endsOn: new Date('2026-12-09'),
        },
      });
      const term = await tx.term.create({
        data: {
          tenantId,
          academicYearId: year.id,
          number: 1,
          startsOn: new Date('2026-01-14'),
          endsOn: new Date('2026-03-27'),
        },
      });
      const user = await tx.userAccount.create({
        data: {
          tenantId,
          subject: `oidc-${randomUUID()}`,
          email: `teacher@${tenantId.slice(0, 8)}.example`,
          displayName: 'A Teacher',
        },
      });
      const role = await tx.roleAssignment.create({
        data: { tenantId, userAccountId: user.id, role: 'teacher' },
      });
      const staff = await tx.staffMember.create({
        data: {
          tenantId,
          schoolId: school.id,
          userAccountId: user.id,
          displayName: 'A Teacher',
        },
      });
      const assignment = await tx.teachingAssignment.create({
        data: {
          tenantId,
          staffMemberId: staff.id,
          classGroupId: classGroup.id,
          subjectId: subject.id,
        },
      });
      const learner = await tx.learner.create({
        data: {
          tenantId,
          schoolId: school.id,
          gradeId: grade.id,
          classGroupId: classGroup.id,
          token: `LNR_${tenantId.slice(0, 6).toUpperCase()}`,
        },
      });
      const identifier = await tx.learnerIdentifier.create({
        data: {
          tenantId,
          learnerId: learner.id,
          kind: 'SASAMS_NUMBER',
          ciphertext: Buffer.from('ciphertext-placeholder'),
          keyVersion: 1,
        },
      });
      const guardian = await tx.guardian.create({
        data: { tenantId, token: `GDN_${tenantId.slice(0, 6).toUpperCase()}` },
      });
      const link = await tx.guardianLink.create({
        data: {
          tenantId,
          guardianId: guardian.id,
          learnerId: learner.id,
          relationship: 'parent',
        },
      });
      const setting = await tx.tenantSetting.create({
        data: { tenantId, key: 'lolt', value: { value: 'en' } },
      });
      const audit = await tx.auditEvent.create({
        data: {
          tenantId,
          action: 'seed',
          resourceType: 'tenant',
          resourceId: tenantId,
          hash: Buffer.from('seed-hash'),
        },
      });

      const created: Record<string, string> = {
        academic_year: year.id,
        audit_event: audit.id,
        class_group: classGroup.id,
        grade: grade.id,
        guardian: guardian.id,
        guardian_link: link.id,
        learner: learner.id,
        learner_identifier: identifier.id,
        phase: phase.id,
        role_assignment: role.id,
        school: school.id,
        staff_member: staff.id,
        subject: subject.id,
        teaching_assignment: assignment.id,
        tenant_setting: setting.id,
        term: term.id,
        user_account: user.id,
      };

      for (const [table, id] of Object.entries(created)) {
        const existing = rowIds.get(table);
        rowIds.set(
          table,
          tenantId === TENANT_A
            ? { a: id, b: existing?.b ?? '' }
            : { a: existing?.a ?? '', b: id },
        );
      }
    });
  }
}

describe('the fixture itself', () => {
  it('seeds a row in every tenant-owned table, for both tenants', () => {
    // If this drifts, the cases below silently stop testing whatever is missing.
    for (const table of TENANT_OWNED_TABLES) {
      const ids = rowIds.get(table);
      expect(
        ids,
        `${table} has no seeded row — the isolation cases below would be vacuous`,
      ).toBeDefined();
      expect(ids!.a, `${table} has no tenant A row`).not.toBe('');
      expect(ids!.b, `${table} has no tenant B row`).not.toBe('');
    }
  });
});

describe.each(TENANT_OWNED_TABLES)('tenant isolation on %s', (table) => {
  const quoted = `"${table}"`;

  it("does not return another tenant's row by primary key", async () => {
    const otherId = rowIds.get(table)!.b;
    const rows = await asTenant(appRw, TENANT_A, ACTOR, (tx) =>
      tx.$queryRawUnsafe<unknown[]>(
        `SELECT id FROM ${quoted} WHERE id = $1::uuid`,
        otherId,
      ),
    );
    expect(rows).toHaveLength(0);
  });

  it("returns its own tenant's row, so the test above is not vacuous", async () => {
    const ownId = rowIds.get(table)!.a;
    const rows = await asTenant(appRw, TENANT_A, ACTOR, (tx) =>
      tx.$queryRawUnsafe<unknown[]>(
        `SELECT id FROM ${quoted} WHERE id = $1::uuid`,
        ownId,
      ),
    );
    expect(rows).toHaveLength(1);
  });

  it("updating another tenant's row affects zero rows", async () => {
    const otherId = rowIds.get(table)!.b;
    const affected = await asTenant(appRw, TENANT_A, ACTOR, (tx) =>
      tx.$executeRawUnsafe(
        `UPDATE ${quoted} SET created_by = $1::uuid WHERE id = $2::uuid`,
        ACTOR,
        otherId,
      ),
    );
    expect(affected).toBe(0);
  });

  it('inserting a row with a foreign tenant_id fails', async () => {
    // The WITH CHECK clause must reject a row whose tenant_id is not the active tenant,
    // even when every other column is valid.
    await expect(
      asTenant(appRw, TENANT_A, ACTOR, (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO ${quoted} (id, tenant_id) VALUES (gen_random_uuid(), $1::uuid)`,
          TENANT_B,
        ),
      ),
    ).rejects.toThrow();
  });

  it('fails loudly when no tenant context is set', async () => {
    // Not "returns nothing" — raises. current_setting(..., false) is what makes this the
    // behaviour, and a regression to the permissive form would turn a loud failure into a
    // silent empty result.
    await expect(
      appRw.$queryRawUnsafe<unknown[]>(`SELECT id FROM ${quoted} LIMIT 1`),
    ).rejects.toThrow();
  });

  it("aggregates cannot observe another tenant's rows", async () => {
    const rows = await asTenant(appRw, TENANT_A, ACTOR, (tx) =>
      tx.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT count(*)::bigint AS count FROM ${quoted}`,
      ),
    );
    // Exactly the one row this tenant owns. A leak would show 2.
    expect(Number(rows[0]!.count)).toBe(1);
  });
});

describe('the tenant table itself', () => {
  it('is isolated by its own primary key', async () => {
    const rows = await asTenant(
      appRw,
      TENANT_A,
      ACTOR,
      (tx) =>
        tx.$queryRaw<unknown[]>`SELECT id FROM "tenant" WHERE id = ${TENANT_B}::uuid`,
    );
    expect(rows).toHaveLength(0);
  });

  it('returns only the active tenant when listing', async () => {
    const rows = await asTenant(
      appRw,
      TENANT_A,
      ACTOR,
      (tx) => tx.$queryRaw<{ id: string }[]>`SELECT id FROM "tenant"`,
    );
    expect(rows).toEqual([{ id: TENANT_A }]);
  });
});

describe('FORCE ROW LEVEL SECURITY', () => {
  it('binds the table owner too', async () => {
    // migrator owns every table. Without FORCE, ownership bypasses RLS and this returns a
    // row — which is precisely the hole that would make the whole suite meaningless.
    const rows = await asTenant(
      migrator,
      TENANT_A,
      ACTOR,
      (tx) =>
        tx.$queryRaw<
          unknown[]
        >`SELECT id FROM "learner" WHERE tenant_id = ${TENANT_B}::uuid`,
    );
    expect(rows).toHaveLength(0);
  });
});

describe('roles', () => {
  it('does not grant BYPASSRLS to any application role', async () => {
    const rows = await migrator.$queryRaw<{ rolname: string; rolbypassrls: boolean }[]>`
      SELECT rolname, rolbypassrls FROM pg_roles
      WHERE rolname IN ('app_rw', 'worker_rw', 'migrator', 'analytics_ro')
    `;
    expect(rows).toHaveLength(4);
    for (const role of rows) {
      expect(role.rolbypassrls, `${role.rolname} can bypass RLS`).toBe(false);
    }
  });

  it('does not grant superuser to any application role', async () => {
    const rows = await migrator.$queryRaw<{ rolname: string; rolsuper: boolean }[]>`
      SELECT rolname, rolsuper FROM pg_roles
      WHERE rolname IN ('app_rw', 'worker_rw', 'migrator', 'analytics_ro')
    `;
    for (const role of rows) {
      expect(role.rolsuper, `${role.rolname} is a superuser`).toBe(false);
    }
  });
});

describe('the audit ledger is append-only', () => {
  it('rejects UPDATE', async () => {
    const id = rowIds.get('audit_event')!.a;
    await expect(
      asTenant(
        migrator,
        TENANT_A,
        ACTOR,
        (tx) =>
          tx.$executeRaw`UPDATE "audit_event" SET action = 'tampered' WHERE id = ${id}::uuid`,
      ),
    ).rejects.toThrow(/append-only/);
  });

  it('rejects DELETE', async () => {
    const id = rowIds.get('audit_event')!.a;
    await expect(
      asTenant(
        migrator,
        TENANT_A,
        ACTOR,
        (tx) => tx.$executeRaw`DELETE FROM "audit_event" WHERE id = ${id}::uuid`,
      ),
    ).rejects.toThrow(/append-only/);
  });

  it('still accepts INSERT', async () => {
    const inserted = await asTenant(appRw, TENANT_A, ACTOR, (tx) =>
      tx.auditEvent.create({
        data: {
          tenantId: TENANT_A,
          action: 'read',
          resourceType: 'learner',
          hash: Buffer.from('another-hash'),
        },
      }),
    );
    expect(inserted.id).toBeDefined();
  });
});
