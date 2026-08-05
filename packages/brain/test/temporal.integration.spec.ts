// The temporal test — Stage 05 step 10.
//
// "What did we decide about X in Term 2 last year" must return the version that was
// current then, not the version that is current now. Nothing new is built for this: a
// ratified L0_CONSTITUTION chain already carries each version's own `ratifiedAt` (step 6's
// provenance), and `explain()` (step 9) already walks that chain newest first. Answering
// an as-of query is composing the two — the current effective row via `findEffectiveBrainFact`
// (step 2), then the first entry in its `explain()` chain whose `ratifiedAt` is at or before
// the asked-about time.

import { randomUUID } from 'node:crypto';

import {
  disconnect,
  findEffectiveBrainFact,
  withTenant,
  type TenantClient,
} from '@infinite-ai/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { explain, ratify, remember } from '../src/api.js';
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

async function seedTenant(): Promise<{ tenantId: string; actorId: string }> {
  const tenantId = randomUUID();
  const actorId = randomUUID();
  await withTenant({ tenantId, actorId }, (tx) =>
    tx.tenant.create({
      data: {
        id: tenantId,
        name: `Temporal Test ${tenantId.slice(0, 8)}`,
        slug: `temporal-${tenantId.slice(0, 8)}`,
        kind: 'SCHOOL',
      },
    }),
  );
  return { tenantId, actorId };
}

describe('a temporal query against a versioned policy', () => {
  it('returns the version that was current in Term 2 last year, not the version current today', async () => {
    const { tenantId, actorId } = await seedTenant();
    const key = `homework_policy_${randomUUID().slice(0, 8)}`;

    // Ratified last year, Term 2 — "no more than one formal task per subject per week."
    const termTwoLastYear = new Date('2025-05-12T00:00:00.000Z');
    // Ratified this year — superseded the Term 2 policy with a different cap.
    const today = new Date('2026-08-01T00:00:00.000Z');

    const { v1Id, v2Id } = await withTenant({ tenantId, actorId }, async (tx) => {
      const v1Awaiting = await remember(tx, {
        targetTier: 'L0_CONSTITUTION',
        rawPayload: {
          key,
          kind: 'SCHOOL_POLICY',
          content: { maxFormalTasksPerWeek: 1 },
        },
        source: 'test',
      });
      const v1 = await ratify(tx, v1Awaiting.id, actorId, termTwoLastYear);

      const v2Awaiting = await remember(tx, {
        targetTier: 'L0_CONSTITUTION',
        rawPayload: {
          key,
          kind: 'SCHOOL_POLICY',
          content: { maxFormalTasksPerWeek: 2 },
        },
        source: 'test',
      });
      const v2 = await ratify(tx, v2Awaiting.id, actorId, today);

      return { v1Id: v1.committedRowId!, v2Id: v2.committedRowId! };
    });

    // A moment squarely inside Term 2 last year, well before this year's ratification.
    const askedAboutTermTwo = new Date('2025-06-10T00:00:00.000Z');

    const asOfTermTwo = await withTenant({ tenantId, actorId }, (tx) =>
      asOf(tx, key, askedAboutTermTwo),
    );
    expect(asOfTermTwo?.id).toBe(v1Id);
    expect(asOfTermTwo?.content).toEqual({ maxFormalTasksPerWeek: 1 });

    // Asking about right now returns the version that is actually current — the mechanism
    // distinguishes "as of a past time" from "as of now," not just "the oldest version."
    const asOfNow = await withTenant({ tenantId, actorId }, (tx) => asOf(tx, key, today));
    expect(asOfNow?.id).toBe(v2Id);
    expect(asOfNow?.content).toEqual({ maxFormalTasksPerWeek: 2 });
  });
});

/**
 * The version of an `L0_CONSTITUTION` fact that was effective at `at` — the current
 * effective row if `at` is now or later, otherwise whichever earlier version in its
 * `explain()` chain was still in force. Built entirely from primitives steps 2, 6 and 9
 * already proved individually; this test is what proves the composition answers the
 * manual's own worked example.
 */
async function asOf(
  tx: TenantClient,
  key: string,
  at: Date,
): Promise<{ readonly id: string; readonly content: unknown } | null> {
  const head = await findEffectiveBrainFact(tx, { targetTier: 'L0_CONSTITUTION', key });
  if (head === null) return null;
  const chain = await explain(tx, 'L0_CONSTITUTION', head.id);
  const effective = chain.find(
    (fact) => fact.ratifiedAt !== null && fact.ratifiedAt <= at,
  );
  if (effective === undefined) return null;
  const row = await tx.brainConstitution.findFirstOrThrow({
    where: { id: effective.id },
  });
  return { id: effective.id, content: row.content };
}
