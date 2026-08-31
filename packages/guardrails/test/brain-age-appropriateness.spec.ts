// createBrainAgeAppropriatenessChecker's own dispatch logic — mocked against
// @infinite-ai/brain's recall()/selectAgeAppropriatenessEntries() so this tier needs no
// database. The real read against a real Postgres is proven in
// brain-age-appropriateness.integration.spec.ts, the same split every other module in this
// codebase that touches @infinite-ai/db already uses.

import type { AgeAppropriatenessSourceEntry } from '@infinite-ai/contracts';
import type { TenantClient } from '@infinite-ai/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const recall = vi.fn();
const selectAgeAppropriatenessEntries = vi.fn();

vi.mock('@infinite-ai/brain', () => ({
  recall: (...args: unknown[]) => recall(...args),
  selectAgeAppropriatenessEntries: (...args: unknown[]) =>
    selectAgeAppropriatenessEntries(...args),
}));

const { createBrainAgeAppropriatenessChecker } =
  await import('../src/brain-age-appropriateness.js');

const FAKE_TX = {} as TenantClient;
const TENANT_ID = '10000000-0000-4000-8000-000000000001';

const clause: AgeAppropriatenessSourceEntry = {
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

beforeEach(() => {
  recall.mockReset();
  selectAgeAppropriatenessEntries.mockReset();
  recall.mockResolvedValue({ candidates: [] });
  selectAgeAppropriatenessEntries.mockReturnValue([clause]);
});

describe('createBrainAgeAppropriatenessChecker', () => {
  it('passes without querying a judge when none is supplied', async () => {
    const checker = createBrainAgeAppropriatenessChecker(
      FAKE_TX,
      TENANT_ID,
      'FOUNDATION',
    );
    const verdict = await checker({ text: 'anything' });
    expect(verdict.passed).toBe(true);
    expect(recall).toHaveBeenCalledTimes(1);
  });

  it('retrieves clauses scoped to the requested phase via recall()', async () => {
    const checker = createBrainAgeAppropriatenessChecker(FAKE_TX, TENANT_ID, 'SENIOR');
    await checker({});
    expect(recall).toHaveBeenCalledWith(
      FAKE_TX,
      expect.objectContaining({ purpose: 'planning', subject: null }),
    );
    expect(selectAgeAppropriatenessEntries).toHaveBeenCalledWith([], { phase: 'SENIOR' });
  });

  it('passes when the injected judge finds the output appropriate', async () => {
    const judge = vi.fn().mockResolvedValue({ appropriate: true, rationale: 'fine' });
    const checker = createBrainAgeAppropriatenessChecker(
      FAKE_TX,
      TENANT_ID,
      'FOUNDATION',
      judge,
    );
    const output = { text: 'a simple story' };
    const verdict = await checker(output);
    expect(verdict.passed).toBe(true);
    expect(judge).toHaveBeenCalledWith([clause], output);
  });

  it("refuses with the judge's rationale when it finds the output inappropriate", async () => {
    const judge = vi
      .fn()
      .mockResolvedValue({ appropriate: false, rationale: 'too advanced for R-3' });
    const checker = createBrainAgeAppropriatenessChecker(
      FAKE_TX,
      TENANT_ID,
      'FOUNDATION',
      judge,
    );
    const verdict = await checker({ text: 'a complex proof' });
    expect(verdict.passed).toBe(false);
    if (!verdict.passed) {
      expect(verdict.refusal.code).toBe('age_inappropriate');
      expect(verdict.refusal.explanation).toBe('too advanced for R-3');
    }
  });
});
