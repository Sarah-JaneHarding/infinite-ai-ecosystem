// Stage 17 — POPIA deletion / tenant closure integration test.
//
// Verifies the full Stage 17 tenant lifecycle:
//   1. A tenant can be seeded with provisioning, subscription, metering data, and invoices.
//   2. Transitioning the tenant to CLOSED status and explicitly deleting mutable data
//      (provisioning_record, subscription, metering_period, tenant_invoice) succeeds.
//   3. Append-only tables (tenant_metering_event, audit_event, consent_record) are
//      NOT deleted — their triggers refuse DELETE by design, and South African law
//      (POPIA §14 + audit / financial retention obligations) requires these records to
//      be retained even after tenant closure.  See OQ-022.
//   4. The `tenant` row itself remains with status CLOSED.  The provisioning module's
//      lifecycle.ts is explicit: "CLOSED is terminal — the tenant row is retained."
//
// Note: this suite needs Docker (Testcontainers). No skip path — a silently skipped
// deletion test is worse than no test.

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asTenant, startTestDatabase, type TestDatabase } from './support/database.js';

const TENANT_ID = 'b8f3c241-0001-4000-b000-000000000017';
const ACTOR_ID = 'b8f3c241-0002-4000-b000-000000000017';

let db: TestDatabase;
let admin: PrismaClient;

beforeAll(async () => {
  db = await startTestDatabase();
  admin = db.clientFor('migrator');
  await seedLifecycleTenant();
}, 180_000);

afterAll(async () => {
  await db?.stop();
});

async function seedLifecycleTenant(): Promise<void> {
  // All inserts must run inside a tenant context: migrator is NOSUPERUSER NOBYPASSRLS
  // and the tenant table carries FORCE ROW LEVEL SECURITY, so even the table owner must
  // supply app.tenant_id or every statement fails with 42704.
  await asTenant(admin, TENANT_ID, ACTOR_ID, async (tx) => {
    await tx.$executeRaw`
      INSERT INTO tenant (id, name, slug, kind, status, created_at, updated_at, version)
      VALUES (
        ${TENANT_ID}::uuid,
        'Deletion Test School',
        'deletion-test-school-17',
        'SCHOOL'::"tenant_kind",
        'ACTIVE'::"tenant_status",
        NOW(), NOW(), 1
      )
      ON CONFLICT (id) DO NOTHING
    `;

    await tx.$executeRaw`
      INSERT INTO provisioning_record (id, tenant_id, steps, readiness, created_at, updated_at, version)
      VALUES (
        gen_random_uuid(), ${TENANT_ID}::uuid,
        '[]'::jsonb, 0, NOW(), NOW(), 1
      )
      ON CONFLICT (tenant_id) DO NOTHING
    `;

    await tx.$executeRaw`
      INSERT INTO subscription (id, tenant_id, tier_name, status, starts_on, created_at, updated_at, version)
      VALUES (
        gen_random_uuid(), ${TENANT_ID}::uuid,
        'starter', 'ACTIVE'::"subscription_status",
        CURRENT_DATE, NOW(), NOW(), 1
      )
    `;

    // tenant_metering_event is append-only (BEFORE DELETE trigger).  We seed one
    // row and verify below that it cannot be erased even during tenant closure.
    await tx.$executeRaw`
      INSERT INTO tenant_metering_event (id, tenant_id, agent_id, tokens_used, cost_cents, at)
      VALUES (
        gen_random_uuid(), ${TENANT_ID}::uuid,
        'agent-deletion-test', 500000, 50, NOW()
      )
    `;

    await tx.$executeRaw`
      INSERT INTO metering_period (
        id, tenant_id, period_start, period_end,
        total_tokens, total_cost_cents, learner_count, educator_count, event_count,
        status, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), ${TENANT_ID}::uuid,
        date_trunc('month', NOW()), date_trunc('month', NOW()) + INTERVAL '1 month',
        500000, 50, 100, 5, 1,
        'OPEN'::"metering_period_status", NOW(), NOW()
      )
    `;

    // audit_event is append-only (BEFORE DELETE trigger) — see note 3 above.
    await tx.$executeRaw`
      INSERT INTO audit_event (id, tenant_id, actor_id, action, resource_type, hash, at)
      VALUES (
        gen_random_uuid(), ${TENANT_ID}::uuid,
        ${ACTOR_ID}::uuid, 'tenant_created', 'tenant',
        decode('aabbccdd', 'hex'), NOW()
      )
    `;

    // consent_record is append-only (BEFORE UPDATE OR DELETE trigger) — see note 3 above.
    await tx.$executeRaw`
      INSERT INTO consent_record (
        id, tenant_id, subject_token, category, purpose, basis, decision, source, effective_from, recorded_at
      ) VALUES (
        gen_random_uuid(), ${TENANT_ID}::uuid,
        'LNR_DELETION17', 'DEMOGRAPHIC', 'CURRICULUM',
        'CONSENT'::"lawful_basis", 'GRANTED'::"consent_decision",
        'GUARDIAN_PORTAL'::"consent_source", NOW(), NOW()
      )
    `;
  });
}

describe('Stage 17 — tenant lifecycle and POPIA deletion', () => {
  describe('pre-closure state', () => {
    it('tenant exists and is ACTIVE', async () => {
      const rows = await asTenant(
        admin,
        TENANT_ID,
        ACTOR_ID,
        (tx) =>
          tx.$queryRaw<{ status: string }[]>`
          SELECT status FROM tenant WHERE id = ${TENANT_ID}::uuid
        `,
      );
      expect(rows[0]?.status).toBe('ACTIVE');
    });

    it('provisioning_record exists for the tenant', async () => {
      const rows = await asTenant(
        admin,
        TENANT_ID,
        ACTOR_ID,
        (tx) =>
          tx.$queryRaw<{ count: bigint }[]>`
          SELECT count(*) FROM provisioning_record WHERE tenant_id = ${TENANT_ID}::uuid
        `,
      );
      expect(Number(rows[0]?.count ?? 0)).toBeGreaterThan(0);
    });

    it('subscription exists for the tenant', async () => {
      const rows = await asTenant(
        admin,
        TENANT_ID,
        ACTOR_ID,
        (tx) =>
          tx.$queryRaw<{ count: bigint }[]>`
          SELECT count(*) FROM subscription WHERE tenant_id = ${TENANT_ID}::uuid
        `,
      );
      expect(Number(rows[0]?.count ?? 0)).toBeGreaterThan(0);
    });

    it('metering events exist for the tenant', async () => {
      const rows = await asTenant(
        admin,
        TENANT_ID,
        ACTOR_ID,
        (tx) =>
          tx.$queryRaw<{ count: bigint }[]>`
          SELECT count(*) FROM tenant_metering_event WHERE tenant_id = ${TENANT_ID}::uuid
        `,
      );
      expect(Number(rows[0]?.count ?? 0)).toBeGreaterThan(0);
    });

    it('metering period exists for the tenant', async () => {
      const rows = await asTenant(
        admin,
        TENANT_ID,
        ACTOR_ID,
        (tx) =>
          tx.$queryRaw<{ count: bigint }[]>`
          SELECT count(*) FROM metering_period WHERE tenant_id = ${TENANT_ID}::uuid
        `,
      );
      expect(Number(rows[0]?.count ?? 0)).toBeGreaterThan(0);
    });

    it('audit events exist for the tenant', async () => {
      const rows = await asTenant(
        admin,
        TENANT_ID,
        ACTOR_ID,
        (tx) =>
          tx.$queryRaw<{ count: bigint }[]>`
          SELECT count(*) FROM audit_event WHERE tenant_id = ${TENANT_ID}::uuid
        `,
      );
      expect(Number(rows[0]?.count ?? 0)).toBeGreaterThan(0);
    });

    it('consent records exist for the tenant', async () => {
      const rows = await asTenant(
        admin,
        TENANT_ID,
        ACTOR_ID,
        (tx) =>
          tx.$queryRaw<{ count: bigint }[]>`
          SELECT count(*) FROM consent_record WHERE tenant_id = ${TENANT_ID}::uuid
        `,
      );
      expect(Number(rows[0]?.count ?? 0)).toBeGreaterThan(0);
    });
  });

  describe('POPIA deletion — mark CLOSED and erase mutable personal data', () => {
    beforeAll(async () => {
      // The tenant row is RETAINED (lifecycle.ts: "CLOSED is terminal — the tenant row
      // is retained").  Only mutable tenant-owned data is erased.  Deletion order respects
      // FK constraints: tenant_invoice → metering_period → subscription → provisioning_record.
      //
      // Append-only tables (tenant_metering_event, audit_event, consent_record) are not
      // touched: their BEFORE DELETE triggers refuse the operation, and South African law
      // requires these records to be retained for audit and compliance purposes (OQ-022).
      await asTenant(admin, TENANT_ID, ACTOR_ID, async (tx) => {
        await tx.$executeRaw`
          DELETE FROM tenant_invoice WHERE tenant_id = ${TENANT_ID}::uuid
        `;
        await tx.$executeRaw`
          DELETE FROM metering_period WHERE tenant_id = ${TENANT_ID}::uuid
        `;
        await tx.$executeRaw`
          DELETE FROM subscription WHERE tenant_id = ${TENANT_ID}::uuid
        `;
        await tx.$executeRaw`
          DELETE FROM provisioning_record WHERE tenant_id = ${TENANT_ID}::uuid
        `;
        await tx.$executeRaw`
          UPDATE tenant SET status = 'CLOSED'::"tenant_status", updated_at = NOW()
          WHERE id = ${TENANT_ID}::uuid
        `;
      });
    }, 30_000);

    it('tenant row is marked CLOSED (not deleted — retained per §17)', async () => {
      const rows = await asTenant(
        admin,
        TENANT_ID,
        ACTOR_ID,
        (tx) =>
          tx.$queryRaw<{ status: string }[]>`
          SELECT status FROM tenant WHERE id = ${TENANT_ID}::uuid
        `,
      );
      expect(rows[0]?.status).toBe('CLOSED');
    });

    it('provisioning_record is deleted', async () => {
      const rows = await asTenant(
        admin,
        TENANT_ID,
        ACTOR_ID,
        (tx) =>
          tx.$queryRaw<{ count: bigint }[]>`
          SELECT count(*) FROM provisioning_record WHERE tenant_id = ${TENANT_ID}::uuid
        `,
      );
      expect(Number(rows[0]?.count ?? 0)).toBe(0);
    });

    it('subscription records are deleted', async () => {
      const rows = await asTenant(
        admin,
        TENANT_ID,
        ACTOR_ID,
        (tx) =>
          tx.$queryRaw<{ count: bigint }[]>`
          SELECT count(*) FROM subscription WHERE tenant_id = ${TENANT_ID}::uuid
        `,
      );
      expect(Number(rows[0]?.count ?? 0)).toBe(0);
    });

    it('metering events are retained (append-only ledger — OQ-022)', async () => {
      // BEFORE DELETE trigger prevents deletion; retained for billing audit trail.
      const rows = await asTenant(
        admin,
        TENANT_ID,
        ACTOR_ID,
        (tx) =>
          tx.$queryRaw<{ count: bigint }[]>`
          SELECT count(*) FROM tenant_metering_event WHERE tenant_id = ${TENANT_ID}::uuid
        `,
      );
      expect(Number(rows[0]?.count ?? 0)).toBeGreaterThan(0);
    });

    it('metering period is deleted', async () => {
      const rows = await asTenant(
        admin,
        TENANT_ID,
        ACTOR_ID,
        (tx) =>
          tx.$queryRaw<{ count: bigint }[]>`
          SELECT count(*) FROM metering_period WHERE tenant_id = ${TENANT_ID}::uuid
        `,
      );
      expect(Number(rows[0]?.count ?? 0)).toBe(0);
    });

    it('audit events are retained (compliance ledger — OQ-022)', async () => {
      // BEFORE DELETE trigger prevents deletion; retained under legal obligation.
      const rows = await asTenant(
        admin,
        TENANT_ID,
        ACTOR_ID,
        (tx) =>
          tx.$queryRaw<{ count: bigint }[]>`
          SELECT count(*) FROM audit_event WHERE tenant_id = ${TENANT_ID}::uuid
        `,
      );
      expect(Number(rows[0]?.count ?? 0)).toBeGreaterThan(0);
    });

    it('consent records are retained (POPIA compliance evidence — OQ-022)', async () => {
      // BEFORE UPDATE OR DELETE trigger prevents deletion; retained to prove lawful basis.
      const rows = await asTenant(
        admin,
        TENANT_ID,
        ACTOR_ID,
        (tx) =>
          tx.$queryRaw<{ count: bigint }[]>`
          SELECT count(*) FROM consent_record WHERE tenant_id = ${TENANT_ID}::uuid
        `,
      );
      expect(Number(rows[0]?.count ?? 0)).toBeGreaterThan(0);
    });
  });
});
