// createBrainAgeAppropriatenessChecker proven against real Postgres: submits and ratifies
// a couple of age-appropriateness clauses through @infinite-ai/brain's own write path,
// then confirms the checker actually retrieves them by phase via a real recall() — not a
// mock — and dispatches them to an injected judge.

import { randomUUID } from 'node:crypto';

import { ratify, submitAgeAppropriatenessEntry } from '@infinite-ai/brain';
import type { AgeAppropriatenessSourceEntry } from '@infinite-ai/contracts';
import { disconnect, withTenant } from '@infinite-ai/db';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createBrainAgeAppropriatenessChecker } from '../src/brain-age-appropriateness.js';
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

const foundationEntry: AgeAppropriatenessSourceEntry = {
  phase: 'FOUNDATION',
  gradeRange: 'R-3',
  subject: 'Life Skills',
  clauseType: 'progression',
  content: 'Content moves from simple to complex across the phase.',
  source: {
    documentId: 'age-appropriateness-src-life-skills',
    documentVersion: 'caps-current',
    clause: '1.3(c)',
    ratifiedBy: null,
  },
};

const seniorEntry: AgeAppropriatenessSourceEntry = {
  phase: 'SENIOR',
  gradeRange: '7-9',
  subject: 'Mathematics',
  clauseType: 'developmental_pacing',
  content: 'Abstract reasoning is introduced progressively across the phase.',
  source: {
    documentId: 'age-appropriateness-src-caps-sp-mathematics-gr-7-9',
    documentVersion: 'caps-current',
    clause: '2.1',
    ratifiedBy: null,
  },
};

describe('createBrainAgeAppropriatenessChecker()', () => {
  it('retrieves only the ratified clauses for the requested phase and passes them to the judge', async () => {
    const tenantId = randomUUID();
    const actorId = randomUUID();
    await withTenant({ tenantId, actorId }, (tx) =>
      tx.tenant.create({
        data: {
          id: tenantId,
          name: `Guardrail checker test tenant ${tenantId.slice(0, 8)}`,
          slug: `guardrail-checker-test-${tenantId.slice(0, 8)}`,
          kind: 'SCHOOL',
        },
      }),
    );

    const now = new Date();
    await withTenant({ tenantId, actorId }, async (tx) => {
      const foundation = await submitAgeAppropriatenessEntry(
        tx,
        foundationEntry,
        0,
        'test',
        now,
      );
      const senior = await submitAgeAppropriatenessEntry(tx, seniorEntry, 1, 'test', now);
      await ratify(tx, foundation.id, actorId, now);
      await ratify(tx, senior.id, actorId, now);
    });

    const judge = vi.fn().mockResolvedValue({ appropriate: true, rationale: 'grounded' });

    const verdict = await withTenant({ tenantId, actorId }, async (tx) => {
      const checker = createBrainAgeAppropriatenessChecker(
        tx,
        tenantId,
        'FOUNDATION',
        judge,
      );
      return checker({ text: 'a simple story' });
    });

    expect(verdict.passed).toBe(true);
    expect(judge).toHaveBeenCalledTimes(1);
    const [clauses] = judge.mock.calls[0] as [AgeAppropriatenessSourceEntry[], unknown];
    expect(clauses).toHaveLength(1);
    expect(clauses[0]?.subject).toBe('Life Skills');
    expect(clauses[0]?.phase).toBe('FOUNDATION');
  });
});
