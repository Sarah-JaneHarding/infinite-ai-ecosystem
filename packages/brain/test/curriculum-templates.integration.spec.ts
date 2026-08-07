// submitTemplateDefinition proven against real Postgres — Stage 08 step 1.
//
// This is a thin wrapper around remember()/ratify(), already proven end to end in
// api.integration.spec.ts; this suite only proves the wrapper's own contribution: that a
// TemplateDefinition round-trips through L0_CONSTITUTION correctly-shaped, and that
// selectTemplateDefinitions can read a ratified one back out of a real recall().

import { randomUUID } from 'node:crypto';

import { disconnect, withTenant } from '@infinite-ai/db';
import type { Actor, Resource } from '@infinite-ai/policy';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ratify } from '../src/api.js';
import {
  selectTemplateDefinitions,
  submitTemplateDefinition,
} from '../src/curriculum-templates.js';
import { recall } from '../src/api.js';
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

const source = {
  documentId: 'school-lesson-plan-template',
  documentVersion: '2026-term1',
  clause: 'as supplied',
  ratifiedBy: null,
};

describe('submitTemplateDefinition()', () => {
  it('opens an L0_CONSTITUTION candidate awaiting ratification', async () => {
    const tenantId = randomUUID();
    const actorId = randomUUID();
    await withTenant({ tenantId, actorId }, (tx) =>
      tx.tenant.create({
        data: {
          id: tenantId,
          name: `Template test tenant ${tenantId.slice(0, 8)}`,
          slug: `template-test-${tenantId.slice(0, 8)}`,
          kind: 'SCHOOL',
        },
      }),
    );

    const definition = {
      artefactType: 'LESSON_PLAN' as const,
      version: '1.0.0',
      source,
      sections: [
        {
          name: 'Header',
          order: 0,
          required: true,
          fields: [{ name: 'Date', required: true }],
        },
      ],
      ratifiedAt: null,
    };

    const awaiting = await withTenant({ tenantId, actorId }, (tx) =>
      submitTemplateDefinition(tx, definition, 'test'),
    );
    expect(awaiting.status).toBe('AWAITING_RATIFICATION');

    const ratifiedAt = new Date('2026-05-01T00:00:00.000Z');
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

    const [found] = selectTemplateDefinitions(result.candidates, 'LESSON_PLAN');
    expect(found?.artefactType).toBe('LESSON_PLAN');
    expect(found?.ratifiedAt).not.toBeNull();
  });
});
