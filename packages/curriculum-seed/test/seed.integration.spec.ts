// Integration tests for the curriculum-seed write path — Stage 29.
//
// These tests require a Docker daemon and a live Postgres 16 + pgvector instance
// launched via Testcontainers. There is no skip path (rule 2 — a silently skipped
// integration suite is indistinguishable from a passing one).
//
// Run with: pnpm --filter @infinite-ai/curriculum-seed test:integration
//
// NOTE: The authoring sandbox has no Docker daemon; these tests are written blind
// and proven in CI, following the same convention as packages/brain/test/*.integration.spec.ts.

import { randomUUID } from 'node:crypto';

import { disconnect, withTenant } from '@infinite-ai/db';
import type { TenantContext } from '@infinite-ai/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildCapsL0Payload, submitCapsSource } from '../src/caps.js';
import { buildAtpL0Payload, submitAtpSource } from '../src/atp.js';
import type { CapsSourceInfo } from '../src/types.js';
import type { ATPSourceDocument } from '@infinite-ai/contracts';
import { startTestDatabase, type TestDatabase } from './support/database.js';

let db: TestDatabase;

// ---------------------------------------------------------------------------
// The tenant-scoped client factory wraps the connection in a transaction and sets
// `app.tenant_id` for RLS. A fresh tenant row is created in beforeAll — `withTenant`
// enforces the tenant FK, so a hardcoded id with nothing behind it would fail every
// write in this suite the same way a real caller's would.
// ---------------------------------------------------------------------------

const TEST_CONTEXT: TenantContext = {
  tenantId: randomUUID(),
  // actorId is a @db.Uuid column (createdBy/actor_id) — a plain string here would fail
  // with "invalid input syntax for type uuid" against a real database.
  actorId: randomUUID(),
};

beforeAll(async () => {
  db = await startTestDatabase();
  process.env.DATABASE_URL = db.appRwUrl;

  await withTenant(TEST_CONTEXT, (tx) =>
    tx.tenant.create({
      data: {
        id: TEST_CONTEXT.tenantId,
        name: `Curriculum-seed test tenant ${TEST_CONTEXT.tenantId.slice(0, 8)}`,
        slug: `curriculum-seed-test-${TEST_CONTEXT.tenantId.slice(0, 8)}`,
        kind: 'SCHOOL',
      },
    }),
  );
}, 180_000);

afterAll(async () => {
  await disconnect();
  await db?.stop();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TEST_CAPS_INFO: CapsSourceInfo = {
  documentId: 'caps-test-mathematics-sp-integration',
  documentVersion: '2011-ratified-test',
  title: 'Mathematics Senior Phase — integration test fixture',
  subject: 'Mathematics',
  phase: 'SENIOR',
  grades: ['7', '8', '9'],
  contentAreas: ['Numbers', 'Algebra'],
  weightings: [
    { contentArea: 'Numbers', grade: '7', weightingPercent: 60, clause: 'test clause' },
  ],
  topicCount: 2,
  source: {
    documentId: 'caps-test-mathematics-sp-integration',
    documentVersion: '2011-ratified-test',
    clause: 'integration test',
    ratifiedBy: null,
  },
};

const TEST_ATP_DOC: ATPSourceDocument = {
  sourceId: 'atp-integration-test-gr7-maths-2023',
  grade: '7',
  phase: 'Senior Phase',
  subject: 'Mathematics',
  atpYear: 2023,
  sourceDescription: 'Integration test ATP fixture',
  topics: [
    {
      sourceId: 'atp-integration-test-gr7-maths-2023',
      grade: '7',
      subject: 'Mathematics',
      term: 1,
      weekStart: 1,
      weekEnd: 2,
      contentArea: 'Numbers',
      topic: 'Whole numbers',
      assessmentType: null,
      hours: 4,
      basis: {
        documentId: 'atp-integration-test-gr7-maths-2023',
        documentVersion: '2023',
        clause: 'term table',
        ratifiedBy: null,
      },
    },
  ],
  fats: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('submitCapsSource (integration)', () => {
  it('reaches AWAITING_RATIFICATION in L0 for a valid CAPS source', async () => {
    // submittedBy becomes createdBy, a @db.Uuid column — must be a real UUID, unlike the
    // pure buildCapsL0Payload call below which never touches the database.
    const row = await withTenant(TEST_CONTEXT, async (tx) =>
      submitCapsSource(tx, TEST_CAPS_INFO, TEST_CONTEXT.actorId),
    );
    expect(row.status).toBe('AWAITING_RATIFICATION');
    expect(row.id).toBeTruthy();
  });

  it('buildCapsL0Payload produces a valid BrainWriteCandidateInput', () => {
    const payload = buildCapsL0Payload(TEST_CAPS_INFO, 'integration-test');
    const raw = payload.rawPayload as Record<string, unknown>;
    expect(payload.targetTier).toBe('L0_CONSTITUTION');
    expect(raw['kind']).toBe('CAPS_CANON');
  });
});

describe('submitAtpSource (integration)', () => {
  it('reaches AWAITING_RATIFICATION in L0 for a valid ATP source', async () => {
    // submittedBy becomes createdBy, a @db.Uuid column — must be a real UUID, unlike the
    // pure buildAtpL0Payload call below which never touches the database.
    const row = await withTenant(TEST_CONTEXT, async (tx) =>
      submitAtpSource(tx, TEST_ATP_DOC, TEST_CONTEXT.actorId),
    );
    expect(row.status).toBe('AWAITING_RATIFICATION');
    expect(row.id).toBeTruthy();
  });

  it('buildAtpL0Payload produces a valid BrainWriteCandidateInput', () => {
    const payload = buildAtpL0Payload(TEST_ATP_DOC, 'integration-test');
    const raw = payload.rawPayload as Record<string, unknown>;
    expect(payload.targetTier).toBe('L0_CONSTITUTION');
    expect(raw['kind']).toBe('ATP_CALENDAR');
  });
});
