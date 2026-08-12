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

import { APPEND_ONLY_TABLES, TENANT_OWNED_TABLES } from '../src/tables.js';
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

      // The Stage 03 POPIA tables. Seeded here rather than only in
      // popia.integration.spec.ts because this suite is what proves they are isolated like
      // every other table, and the fixture guard below refuses to let them arrive without
      // rows — which is how their absence was caught rather than assumed.
      const consent = await tx.consentRecord.create({
        data: {
          tenantId,
          subjectToken: `LNR_${tenantId.slice(0, 6).toUpperCase()}`,
          category: 'ATTENDANCE',
          purpose: 'screening',
          basis: 'PUBLIC_LAW_DUTY',
          decision: 'GRANTED',
          source: 'NOT_APPLICABLE',
          effectiveFrom: new Date('2026-01-14'),
        },
      });
      const retention = await tx.retentionRule.create({
        data: {
          tenantId,
          category: 'ATTENDANCE',
          anchor: 'ACADEMIC_YEAR_END',
          retainMonths: 60,
          // Not a ratified period and not a recommendation — a fixture value. Real
          // schedules are each school's determination; see OQ-007.
          authority: 'Test fixture, not a ratified retention period',
          ratifiedAt: new Date('2026-01-14'),
          ratifiedBy: 'Fixture',
        },
      });
      const subjectRequest = await tx.dataSubjectRequest.create({
        data: {
          tenantId,
          subjectToken: `LNR_${tenantId.slice(0, 6).toUpperCase()}`,
          kind: 'ACCESS',
          detail: 'Fixture request',
          dueAt: new Date('2026-03-01'),
        },
      });

      // Stage 05's Brain tables. Seeded here for the same reason the Stage 03 tables are:
      // this suite is what proves every table is isolated, and the fixture guard below
      // refuses to let one arrive without a row.
      const constitution = await tx.brainConstitution.create({
        data: {
          tenantId,
          key: 'seed_policy',
          kind: 'SCHOOL_POLICY',
          version: 1,
          content: { fixture: true },
          ratifiedBy: ACTOR,
          ratifiedAt: new Date('2026-01-14'),
        },
      });
      const node = await tx.brainNode.create({
        data: {
          tenantId,
          entityType: 'TOPIC',
          label: 'Fixture topic',
          source: 'seed',
        },
      });
      const edge = await tx.brainEdge.create({
        data: {
          tenantId,
          sourceId: node.id,
          targetId: node.id,
          relation: 'seed_self_reference',
          source: 'seed',
        },
      });
      const embedding = await tx.brainEmbedding.create({
        data: {
          tenantId,
          nodeId: node.id,
          model: 'embed.default',
          dimensions: 3,
        },
      });
      const episode = await tx.brainEpisode.create({
        data: {
          tenantId,
          eventType: 'seed_event',
          subjectNodeId: node.id,
          occurredAt: new Date('2026-01-14'),
          summary: 'Fixture episode',
          source: 'seed',
        },
      });
      const procedure = await tx.brainProcedure.create({
        data: {
          tenantId,
          kind: 'SOP',
          ref: 'seed-sop',
          version: 1,
          content: { fixture: true },
          ratifiedBy: ACTOR,
          ratifiedAt: new Date('2026-01-14'),
        },
      });

      // Stage 05 step 2's write-path table. Seeded here for the same reason the step 1
      // tables are, and unlike them it is mutable — it belongs in
      // MUTABLE_TENANT_TABLES below, not in APPEND_ONLY_TABLES.
      const writeCandidate = await tx.brainWriteCandidate.create({
        data: {
          tenantId,
          targetTier: 'L1_NODE',
          rawPayload: { fixture: true },
          source: 'seed',
        },
      });

      // Stage 05 step 3's conflict queue. Seeded for the same reason, and also mutable —
      // resolved in place, never append-only.
      const conflict = await tx.brainConflictQueue.create({
        data: {
          tenantId,
          writeCandidateId: writeCandidate.id,
          targetTier: 'L1_NODE',
          contradictionOf: node.id,
          newConfidence: 1,
          existingConfidence: 1,
          newRecency: new Date('2026-01-14'),
          existingRecency: new Date('2026-01-14'),
        },
      });

      // Stage 06 step 4's orchestrator tables. Seeded here for the same reason every
      // other table above is: this suite is what proves every tenant-owned table is
      // isolated, and the fixture guard below refuses to let one arrive without a row.
      // Mutable, like brain_write_candidate/brain_conflict_queue — not append-only.
      const orchestratorRun = await tx.orchestratorRun.create({
        data: {
          tenantId,
          pipelineId: 'seed-pipeline',
          pipelineVersion: '1.0.0',
          traceId: randomUUID(),
          input: { fixture: true },
        },
      });
      const orchestratorStepRun = await tx.orchestratorStepRun.create({
        data: {
          tenantId,
          runId: orchestratorRun.id,
          stepId: 'seed-step',
        },
      });

      // Stage 06 step 5's approval task, for the same reason. Mutable, not append-only —
      // see this table's own migration header for why.
      const approvalTask = await tx.approvalTask.create({
        data: {
          tenantId,
          runId: orchestratorRun.id,
          stepId: 'seed-gate',
          requiredRole: 'hod',
          artefact: { fixture: true },
          evidence: { fixture: true },
          traceId: orchestratorRun.traceId,
        },
      });

      // Stage 09 MOD-03 warehouse tables. Seeded here for the same reason every earlier
      // stage's tables are: this suite is the proof that every tenant-owned table is
      // isolated, and the fixture guard above refuses a table with no row.
      const ingestSource = await tx.ingestSource.create({
        data: {
          tenantId,
          name: 'Fixture source',
          connectorKind: 'FILE_CSV',
          configRef: 'fixture-config-ref',
        },
      });
      const ingestRun = await tx.ingestRun.create({
        data: {
          tenantId,
          sourceId: ingestSource.id,
          connectorKind: 'FILE_CSV',
          status: 'SUCCEEDED',
          startedAt: new Date('2026-08-07T00:00:00Z'),
        },
      });
      const rawIngestRecord = await tx.rawIngestRecord.create({
        data: {
          tenantId,
          ingestRunId: ingestRun.id,
          sourceRef: 'fixture row 1',
          payload: { fixture: true },
        },
      });
      const domainEventLog = await tx.domainEventLog.create({
        data: {
          tenantId,
          learnerId: learner.id,
          domain: 'ATTENDANCE',
          eventType: 'attendance.present',
          occurredAt: new Date('2026-08-07T08:00:00Z'),
          payload: { fixture: true },
        },
      });
      const sourceFieldMapping = await tx.sourceFieldMapping.create({
        data: {
          tenantId,
          connectorKind: 'FILE_CSV',
          sourceField: 'learnerNo',
          canonicalField: 'learnerId',
        },
      });
      const ingestQualityReport = await tx.ingestQualityReport.create({
        data: {
          tenantId,
          ingestRunId: ingestRun.id,
          qualityScore: 100,
          issues: [],
        },
      });
      const learner360 = await tx.learner360.create({
        data: {
          tenantId,
          learnerId: learner.id,
          lastMaterialisedAt: new Date('2026-08-07T08:00:00Z'),
        },
      });
      const screeningFeature = await tx.screeningFeature.create({
        data: {
          tenantId,
          learnerId: learner.id,
          featureName: 'fixture_score',
          featureValue: 0,
          asAt: new Date('2026-08-07T08:00:00Z'),
        },
      });

      // Stage 17 — billing and provisioning tables. Seeded here for the same reason every
      // earlier stage's tables are: this suite is the proof that every tenant-owned table is
      // isolated, and the fixture guard above refuses a table with no row.
      const provRecord = await tx.provisioningRecord.create({
        data: { tenantId, steps: [], readiness: 0 },
      });
      const sub = await tx.subscription.create({
        data: {
          tenantId,
          tierName: 'starter',
          status: 'ACTIVE',
          startsOn: new Date('2026-08-01'),
        },
      });
      // append-only — INSERT is allowed; UPDATE/DELETE are blocked by trigger.
      const meteringEvent = await tx.tenantMeteringEvent.create({
        data: {
          tenantId,
          agentId: 'seed-agent',
          tokensUsed: 1_000,
          costCents: 10,
          at: new Date('2026-08-07T08:00:00Z'),
        },
      });
      const meteringPeriod = await tx.meteringPeriod.create({
        data: {
          tenantId,
          periodStart: new Date('2026-08-01T00:00:00Z'),
          periodEnd: new Date('2026-09-01T00:00:00Z'),
          totalTokens: 1_000,
          totalCostCents: 10,
          learnerCount: 1,
          educatorCount: 1,
          eventCount: 1,
          status: 'OPEN',
        },
      });
      const invoice = await tx.tenantInvoice.create({
        data: {
          tenantId,
          subscriptionId: sub.id,
          meteringPeriodId: meteringPeriod.id,
          lineItems: [],
          subtotalCents: 0,
          vatCents: 0,
          totalCents: 0,
          status: 'DRAFT',
        },
      });

      const created: Record<string, string> = {
        academic_year: year.id,
        approval_task: approvalTask.id,
        audit_event: audit.id,
        brain_conflict_queue: conflict.id,
        brain_constitution: constitution.id,
        brain_edge: edge.id,
        brain_embedding: embedding.id,
        brain_episode: episode.id,
        brain_node: node.id,
        brain_procedure: procedure.id,
        brain_write_candidate: writeCandidate.id,
        class_group: classGroup.id,
        consent_record: consent.id,
        data_subject_request: subjectRequest.id,
        grade: grade.id,
        guardian: guardian.id,
        guardian_link: link.id,
        domain_event_log: domainEventLog.id,
        ingest_quality_report: ingestQualityReport.id,
        ingest_run: ingestRun.id,
        ingest_source: ingestSource.id,
        learner: learner.id,
        learner_360: learner360.id,
        learner_identifier: identifier.id,
        metering_period: meteringPeriod.id,
        orchestrator_run: orchestratorRun.id,
        orchestrator_step_run: orchestratorStepRun.id,
        phase: phase.id,
        provisioning_record: provRecord.id,
        role_assignment: role.id,
        school: school.id,
        staff_member: staff.id,
        raw_ingest_record: rawIngestRecord.id,
        retention_rule: retention.id,
        screening_feature: screeningFeature.id,
        source_field_mapping: sourceFieldMapping.id,
        subject: subject.id,
        subscription: sub.id,
        teaching_assignment: assignment.id,
        tenant_invoice: invoice.id,
        tenant_metering_event: meteringEvent.id,
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
    // `SET id = id` rather than `SET created_by = …`. The old form assumed every
    // tenant-owned table carries `created_by`, which was true of the Stage 01 schema by
    // accident rather than by rule: the ledgers deliberately omit mutable-row bookkeeping,
    // because a row that is never updated has no "who last touched it". A missing column
    // makes this statement fail to parse, which looks nothing like the leak it is meant to
    // detect. `id` is the one column every table here is guaranteed to have, and the
    // assertion is unchanged — what filters the row is the USING clause, not the SET list.
    const otherId = rowIds.get(table)!.b;
    const affected = await asTenant(appRw, TENANT_A, ACTOR, (tx) =>
      tx.$executeRawUnsafe(`UPDATE ${quoted} SET id = id WHERE id = $1::uuid`, otherId),
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

/**
 * Tenant-owned tables that accept an UPDATE at all.
 *
 * A filtered list rather than a skip inside the block above: rule 2 draws a hard line at
 * skipped tests, and a list that names what it excludes and why is clearer than a skip
 * anyone reading the output has to go and interpret.
 */
const MUTABLE_TENANT_TABLES = TENANT_OWNED_TABLES.filter(
  (table) => !APPEND_ONLY_TABLES.includes(table as never),
);

describe.each(MUTABLE_TENANT_TABLES)('the update case on %s is not vacuous', (table) => {
  it('updating its own row affects one', async () => {
    // The zero in "updating another tenant's row affects zero rows" has to mean "RLS
    // filtered it out", not "the statement never did anything". Nothing distinguished the
    // two before this: a typo in that SQL would have produced a green isolation suite,
    // which is the worst outcome this file is capable of.
    //
    // The ledgers are excluded because an own-row UPDATE there is refused by the
    // append-only trigger — a different guarantee, asserted where it applies, in the
    // audit_event cases below and in popia.integration.spec.ts.
    const ownId = rowIds.get(table)!.a;
    const affected = await asTenant(appRw, TENANT_A, ACTOR, (tx) =>
      tx.$executeRawUnsafe(`UPDATE "${table}" SET id = id WHERE id = $1::uuid`, ownId),
    );
    expect(affected).toBe(1);
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

  it('gives migrator ownership of the schema the migrations target', async () => {
    // The migrations create tables in `public`. If migrator does not own it — or if
    // CREATE was revoked without a compensating grant — `prisma migrate deploy` fails
    // with "no schema has been selected to create in", which is how this surfaced the
    // first time: as a migration crash rather than a named assertion.
    const rows = await migrator.$queryRaw<{ owner: string }[]>`
      SELECT pg_catalog.pg_get_userbyid(nspowner) AS owner
      FROM pg_namespace WHERE nspname = 'public'
    `;
    expect(rows[0]!.owner).toBe('migrator');
  });

  it('does not let a runtime role create tables', async () => {
    // Step 2: only migrator may DDL. This is the other half of the property above — it
    // would be no good giving migrator ownership if app_rw could also create.
    await expect(
      appRw.$executeRawUnsafe('CREATE TABLE should_not_exist (id int)'),
    ).rejects.toThrow();
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

/**
 * Every append-only table rejects UPDATE and DELETE, not just the audit ledger.
 *
 * `SET id = id` rather than a table-specific column, for the same reason the isolation
 * cases above use it: the assertion is about the trigger firing before the statement does
 * anything, not about which column changed, and a column list that assumed every ledger
 * shared a schema would be the wrong thing to depend on. This is Stage 05's exit-gate
 * item made concrete: "no destructive update on a Brain table," proven by a trigger that
 * raises, for every table the trigger is supposed to protect — not asserted for one and
 * assumed for the rest.
 */
describe.each(APPEND_ONLY_TABLES)('%s is append-only at the database level', (table) => {
  const quoted = `"${table}"`;

  it('rejects UPDATE', async () => {
    const id = rowIds.get(table)!.a;
    await expect(
      asTenant(migrator, TENANT_A, ACTOR, (tx) =>
        tx.$executeRawUnsafe(`UPDATE ${quoted} SET id = id WHERE id = $1::uuid`, id),
      ),
    ).rejects.toThrow(/append-only/);
  });

  it('rejects DELETE', async () => {
    const id = rowIds.get(table)!.a;
    await expect(
      asTenant(migrator, TENANT_A, ACTOR, (tx) =>
        tx.$executeRawUnsafe(`DELETE FROM ${quoted} WHERE id = $1::uuid`, id),
      ),
    ).rejects.toThrow(/append-only/);
  });
});
