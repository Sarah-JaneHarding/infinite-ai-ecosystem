// submitAgeAppropriatenessEntry proven against real Postgres.
//
// This is a thin wrapper around remember()/ratify(), already proven end to end in
// api.integration.spec.ts; this suite only proves the wrapper's own contribution: that an
// AgeAppropriatenessSourceEntry round-trips through L0_CONSTITUTION correctly-shaped, and
// that selectAgeAppropriatenessEntries can read a ratified one back out of a real recall().

import { randomUUID } from 'node:crypto';

import { disconnect, withTenant } from '@infinite-ai/db';
import type { Actor, Resource } from '@infinite-ai/policy';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ratify, recall } from '../src/api.js';
import {
  keyFor,
  selectAgeAppropriatenessEntries,
  submitAgeAppropriatenessEntry,
} from '../src/age-appropriateness.js';
import type { RetrievalQuery } from '../src/retrieval-types.js';
import { startTestDatabase, type TestDatabase } from './support/database.js';

let db: TestDatabase;

beforeAll(async () => {
  db = await startTestDatabase();
  process.env.DATABASE_URL = db.appRwUrl;
}, 180_000);

afterAll(async () => {
  await disconnect();
  await db?.stop();
});

const entry = {
  phase: 'FOUNDATION' as const,
  gradeRange: 'R-3',
  subject: 'Life Skills',
  clauseType: 'progression',
  content:
    'Content and context at each grade level is designed to move from simple to complex.',
  source: {
    documentId: 'age-appropriateness-src-life-skills',
    documentVersion: 'caps-current',
    clause: '1.3(c) General Principles of the National Curriculum Statement',
    ratifiedBy: null,
  },
};

describe('submitAgeAppropriatenessEntry()', () => {
  it('opens an L0_CONSTITUTION candidate awaiting ratification', async () => {
    const tenantId = randomUUID();
    const actorId = randomUUID();
    await withTenant({ tenantId, actorId }, (tx) =>
      tx.tenant.create({
        data: {
          id: tenantId,
          name: `Age-appropriateness test tenant ${tenantId.slice(0, 8)}`,
          slug: `age-appropriateness-test-${tenantId.slice(0, 8)}`,
          kind: 'SCHOOL',
        },
      }),
    );

    const awaiting = await withTenant({ tenantId, actorId }, (tx) =>
      submitAgeAppropriatenessEntry(tx, entry, 0, 'test'),
    );
    expect(awaiting.status).toBe('AWAITING_RATIFICATION');

    const ratifiedAt = new Date('2026-08-25T00:00:00.000Z');
    const committed = await withTenant({ tenantId, actorId }, (tx) =>
      ratify(tx, awaiting.id, actorId, ratifiedAt),
    );
    expect(committed.status).toBe('RETENTION_SCHEDULED');

    const smtActor: Actor = {
      userId: actorId,
      tenantId,
      grants: [
        {
          role: 'smt',
          schoolId: null,
          classGroupId: null,
          subjectId: null,
          expiresAt: null,
        },
      ],
      guardianOfLearnerIds: [],
      impersonating: false,
    };
    const learnerResource: Resource = {
      type: 'learner',
      tenantId,
      schoolId: null,
      classGroupId: null,
      subjectId: null,
      learnerId: null,
      ownerId: null,
    };
    const query: RetrievalQuery = {
      actor: smtActor,
      resource: learnerResource,
      purpose: 'planning',
      subject: null,
      entityTypeHints: null,
      queryEmbedding: null,
      vectorK: 5,
      graphHops: 0,
      episodicWindow: null,
      episodicSubjectNodeId: null,
      tokenBudget: 1000,
      now: ratifiedAt,
    };
    const result = await withTenant({ tenantId, actorId }, (tx) => recall(tx, query));

    const [found] = selectAgeAppropriatenessEntries(result.candidates, {
      subject: 'Life Skills',
    });
    expect(found?.subject).toBe('Life Skills');
    expect(found?.source.ratifiedBy).toBeNull();
    expect(keyFor(0)).toBe('age-appropriateness-000');
  });
});
