// Stage 09 step 8 — analytics_ro views integration tests.
//
// Three things are proven here:
//   1. analytics_ro CAN select from the three de-identified views when the tenant
//      context is set.
//   2. analytics_ro is DENIED direct access to the base tables (domain_event_log,
//      ingest_run, ingest_quality_report).
//   3. The domain_event view does NOT expose the raw learner_id — only the SHA-256
//      hex digest (learner_token).
//
// Runs against a real Postgres via Testcontainers; no skip path.

import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { asTenant, startTestDatabase, type TestDatabase } from './support/database.js';

let db: TestDatabase;
let migrator: PrismaClient;
let analyticsRo: PrismaClient;

const TENANT_ID = randomUUID();
const ACTOR_ID = randomUUID();

let learnerId: string;
let ingestRunId: string;

beforeAll(async () => {
  db = await startTestDatabase();
  migrator = db.clientFor('migrator');
  analyticsRo = db.clientFor('analytics_ro');
  await seedFixtures();
}, 180_000);

afterAll(async () => {
  await db?.stop();
});

async function seedFixtures(): Promise<void> {
  await asTenant(migrator, TENANT_ID, ACTOR_ID, async (tx) => {
    await tx.tenant.create({
      data: {
        id: TENANT_ID,
        name: 'Analytics Test Tenant',
        slug: `t-${TENANT_ID.slice(0, 8)}`,
        kind: 'SCHOOL',
      },
    });
  });

  await asTenant(migrator, TENANT_ID, ACTOR_ID, async (tx) => {
    const school = await tx.school.create({
      data: { tenantId: TENANT_ID, name: 'Main Campus', lolt: 'en' },
    });
    const phase = await tx.phase.create({
      data: { tenantId: TENANT_ID, schoolId: school.id, name: 'Intermediate' },
    });
    const grade = await tx.grade.create({
      data: { tenantId: TENANT_ID, phaseId: phase.id, label: '6', ordinal: 6 },
    });
    const classGroup = await tx.classGroup.create({
      data: {
        tenantId: TENANT_ID,
        schoolId: school.id,
        gradeId: grade.id,
        name: '6A',
      },
    });
    const learner = await tx.learner.create({
      data: {
        tenantId: TENANT_ID,
        schoolId: school.id,
        gradeId: grade.id,
        classGroupId: classGroup.id,
        token: `LNR_${TENANT_ID.slice(0, 6).toUpperCase()}`,
      },
    });
    learnerId = learner.id;

    const ingestSource = await tx.ingestSource.create({
      data: {
        tenantId: TENANT_ID,
        name: 'Analytics fixture source',
        connectorKind: 'FILE_CSV',
        configRef: 'fixture-config-ref',
      },
    });
    const ingestRun = await tx.ingestRun.create({
      data: {
        tenantId: TENANT_ID,
        sourceId: ingestSource.id,
        connectorKind: 'FILE_CSV',
        status: 'SUCCEEDED',
        startedAt: new Date('2026-08-07T00:00:00Z'),
        completedAt: new Date('2026-08-07T01:00:00Z'),
        recordsReceived: 100,
        recordsConformed: 95,
        recordsRejected: 5,
      },
    });
    ingestRunId = ingestRun.id;

    await tx.ingestQualityReport.create({
      data: {
        tenantId: TENANT_ID,
        ingestRunId: ingestRun.id,
        qualityScore: 95,
        issues: [],
      },
    });

    await tx.domainEventLog.create({
      data: {
        tenantId: TENANT_ID,
        learnerId: learner.id,
        domain: 'ATTENDANCE',
        eventType: 'attendance.present',
        occurredAt: new Date('2026-08-07T08:00:00Z'),
        payload: { attendanceStatus: 'PRESENT', rawId: 'sensitive-raw-id' },
      },
    });
  });
}

// ---------------------------------------------------------------------------
// analytics_ro can SELECT from the three views
// ---------------------------------------------------------------------------

describe('analytics_ro — view access', () => {
  it('can select from v_analytics_ingest_run with tenant context', async () => {
    const rows = await asTenant(
      analyticsRo,
      TENANT_ID,
      ACTOR_ID,
      (tx) =>
        tx.$queryRaw<{ run_id: string }[]>`
          SELECT run_id FROM v_analytics_ingest_run
          WHERE tenant_id = ${TENANT_ID}::uuid
        `,
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]!.run_id).toBe(ingestRunId);
  });

  it('can select from v_analytics_quality_report with tenant context', async () => {
    const rows = await asTenant(
      analyticsRo,
      TENANT_ID,
      ACTOR_ID,
      (tx) =>
        tx.$queryRaw<{ report_id: string; quality_score: number }[]>`
          SELECT report_id, quality_score FROM v_analytics_quality_report
          WHERE tenant_id = ${TENANT_ID}::uuid
        `,
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]!.quality_score).toBe(95);
  });

  it('can select from v_analytics_domain_event with tenant context', async () => {
    const rows = await asTenant(
      analyticsRo,
      TENANT_ID,
      ACTOR_ID,
      (tx) =>
        tx.$queryRaw<{ event_id: string; learner_token: string }[]>`
          SELECT event_id, learner_token FROM v_analytics_domain_event
          WHERE tenant_id = ${TENANT_ID}::uuid
        `,
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]!.learner_token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('sees only its own tenant rows through the views', async () => {
    const OTHER_TENANT = randomUUID();
    const rows = await asTenant(
      analyticsRo,
      OTHER_TENANT,
      ACTOR_ID,
      (tx) =>
        tx.$queryRaw<{ run_id: string }[]>`
          SELECT run_id FROM v_analytics_ingest_run
        `,
    );
    // Other tenant has no data — the view enforces tenant isolation via RLS.
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// The domain_event view does NOT expose raw learner_id
// ---------------------------------------------------------------------------

describe('v_analytics_domain_event — PII protection', () => {
  it('does not include a learner_id column', async () => {
    const rows = await asTenant(
      analyticsRo,
      TENANT_ID,
      ACTOR_ID,
      (tx) =>
        tx.$queryRaw<Record<string, unknown>[]>`
          SELECT * FROM v_analytics_domain_event
          WHERE tenant_id = ${TENANT_ID}::uuid
          LIMIT 1
        `,
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(Object.keys(rows[0]!)).not.toContain('learner_id');
    expect(Object.keys(rows[0]!)).not.toContain('payload');
  });

  it('learner_token is a SHA-256 hex string, not the raw UUID', async () => {
    const rows = await asTenant(
      analyticsRo,
      TENANT_ID,
      ACTOR_ID,
      (tx) =>
        tx.$queryRaw<{ learner_token: string }[]>`
          SELECT learner_token FROM v_analytics_domain_event
          WHERE tenant_id = ${TENANT_ID}::uuid
          LIMIT 1
        `,
    );
    const token = rows[0]!.learner_token;
    // SHA-256 → 64 lowercase hex characters.
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    // Must not be the raw learner UUID.
    expect(token).not.toBe(learnerId);
    expect(token).not.toBe(learnerId.replace(/-/g, ''));
  });

  it('the same learner hashes consistently across two queries', async () => {
    const first = await asTenant(
      analyticsRo,
      TENANT_ID,
      ACTOR_ID,
      (tx) =>
        tx.$queryRaw<{ learner_token: string }[]>`
          SELECT learner_token FROM v_analytics_domain_event
          WHERE tenant_id = ${TENANT_ID}::uuid
          LIMIT 1
        `,
    );
    const second = await asTenant(
      analyticsRo,
      TENANT_ID,
      ACTOR_ID,
      (tx) =>
        tx.$queryRaw<{ learner_token: string }[]>`
          SELECT learner_token FROM v_analytics_domain_event
          WHERE tenant_id = ${TENANT_ID}::uuid
          LIMIT 1
        `,
    );
    expect(first[0]!.learner_token).toBe(second[0]!.learner_token);
  });
});

// ---------------------------------------------------------------------------
// analytics_ro is DENIED direct access to base tables
// ---------------------------------------------------------------------------

describe('analytics_ro — base table access denied', () => {
  it('cannot select from domain_event_log directly', async () => {
    await expect(
      asTenant(
        analyticsRo,
        TENANT_ID,
        ACTOR_ID,
        (tx) => tx.$queryRaw`SELECT id FROM domain_event_log LIMIT 1`,
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('cannot select from ingest_run directly', async () => {
    await expect(
      asTenant(
        analyticsRo,
        TENANT_ID,
        ACTOR_ID,
        (tx) => tx.$queryRaw`SELECT id FROM ingest_run LIMIT 1`,
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('cannot select from ingest_quality_report directly', async () => {
    await expect(
      asTenant(
        analyticsRo,
        TENANT_ID,
        ACTOR_ID,
        (tx) => tx.$queryRaw`SELECT id FROM ingest_quality_report LIMIT 1`,
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('cannot select from learner directly', async () => {
    await expect(
      asTenant(
        analyticsRo,
        TENANT_ID,
        ACTOR_ID,
        (tx) => tx.$queryRaw`SELECT id FROM learner LIMIT 1`,
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('cannot select from learner_identifier directly', async () => {
    await expect(
      asTenant(
        analyticsRo,
        TENANT_ID,
        ACTOR_ID,
        (tx) => tx.$queryRaw`SELECT id FROM learner_identifier LIMIT 1`,
      ),
    ).rejects.toThrow(/permission denied/i);
  });
});

// ---------------------------------------------------------------------------
// analytics_ro has no BYPASSRLS privilege
// ---------------------------------------------------------------------------

describe('analytics_ro — role hardening', () => {
  it('does not have BYPASSRLS', async () => {
    const rows = await migrator.$queryRaw<{ rolbypassrls: boolean }[]>`
      SELECT rolbypassrls FROM pg_roles WHERE rolname = 'analytics_ro'
    `;
    expect(rows[0]!.rolbypassrls).toBe(false);
  });

  it('requires tenant context — errors without it', async () => {
    await expect(
      analyticsRo.$queryRaw`SELECT run_id FROM v_analytics_ingest_run LIMIT 1`,
    ).rejects.toThrow();
  });
});
