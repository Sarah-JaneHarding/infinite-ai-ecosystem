// Unit tests for seedCurriculumFromContracts — Stage 29.
// `remember` is mocked so no database is needed; the integration tier proves the
// write path against real Postgres (seed.integration.spec.ts).

import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock the brain module before importing seed so the factory captures the mock.
vi.mock('@infinite-ai/brain', () => ({
  remember: vi.fn(),
}));

import { remember } from '@infinite-ai/brain';
import type { BrainWriteCandidateRow } from '@infinite-ai/db';
import { ALL_CAPS_SOURCES } from '../src/all-caps-sources.js';
import { seedCurriculumFromContracts } from '../src/seed.js';
import {
  ATP_FOUNDATION_SOURCES,
  ATP_INTERMEDIATE_SOURCES,
  ATP_SENIOR_SOURCES,
} from '@infinite-ai/contracts';

const mockRemember = vi.mocked(remember);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFakeRow(id: string): BrainWriteCandidateRow {
  return {
    id,
    status: 'AWAITING_RATIFICATION',
    createdAt: new Date(),
  } as unknown as BrainWriteCandidateRow;
}

const fakeTx = {} as Parameters<typeof seedCurriculumFromContracts>[0];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('seedCurriculumFromContracts', () => {
  beforeEach(() => {
    mockRemember.mockReset();
    let callCount = 0;
    mockRemember.mockImplementation(() =>
      Promise.resolve(makeFakeRow(`candidate-${++callCount}`)),
    );
  });

  it('calls remember once per CAPS source document', async () => {
    await seedCurriculumFromContracts(fakeTx, 'system');
    // remember is called for each CAPS doc + each ATP doc
    const capsCallCount = ALL_CAPS_SOURCES.length;
    const atpCallCount =
      ATP_FOUNDATION_SOURCES.length +
      ATP_INTERMEDIATE_SOURCES.length +
      ATP_SENIOR_SOURCES.length;
    expect(mockRemember).toHaveBeenCalledTimes(capsCallCount + atpCallCount);
  });

  it('returns capsSubmitted equal to ALL_CAPS_SOURCES.length', async () => {
    const result = await seedCurriculumFromContracts(fakeTx, 'system');
    expect(result.capsSubmitted).toBe(ALL_CAPS_SOURCES.length);
  });

  it('returns atpSubmitted equal to the total live ATP source count', async () => {
    const result = await seedCurriculumFromContracts(fakeTx, 'system');
    const expected =
      ATP_FOUNDATION_SOURCES.length +
      ATP_INTERMEDIATE_SOURCES.length +
      ATP_SENIOR_SOURCES.length;
    expect(result.atpSubmitted).toBe(expected);
  });

  it('returns candidateIds with one entry per submitted document', async () => {
    const result = await seedCurriculumFromContracts(fakeTx, 'system');
    expect(result.candidateIds).toHaveLength(result.capsSubmitted + result.atpSubmitted);
  });

  it('passes submittedBy through to remember via createdBy', async () => {
    await seedCurriculumFromContracts(fakeTx, 'seed-user');
    const calls = mockRemember.mock.calls;
    // First call is the first CAPS source
    expect(calls[0]?.[1]).toMatchObject({ createdBy: 'seed-user' });
  });

  it('propagates an error from remember without partial results', async () => {
    mockRemember.mockImplementationOnce(() =>
      Promise.reject(new Error('DB unavailable')),
    );
    await expect(seedCurriculumFromContracts(fakeTx, 'system')).rejects.toThrow(
      'DB unavailable',
    );
  });
});
