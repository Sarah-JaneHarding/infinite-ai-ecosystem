// Unit tests for ratifyCurriculumForTenant — Stage 30.
// `listOpenBrainWrites` and `ratify` (brain) are mocked so no database is needed.

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@infinite-ai/db', () => ({
  listOpenBrainWrites: vi.fn(),
}));
vi.mock('@infinite-ai/brain', () => ({
  ratify: vi.fn(),
}));

import { listOpenBrainWrites } from '@infinite-ai/db';
import { ratify as brainRatify } from '@infinite-ai/brain';
import type { BrainWriteCandidateRow } from '@infinite-ai/db';
import { ratifyCurriculumForTenant } from '../src/ratify.js';

const mockListOpen = vi.mocked(listOpenBrainWrites);
const mockRatify = vi.mocked(brainRatify);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRow(id: string): BrainWriteCandidateRow {
  return {
    id,
    status: 'AWAITING_RATIFICATION',
    targetTier: 'L0_CONSTITUTION',
    createdAt: new Date(),
  } as unknown as BrainWriteCandidateRow;
}

function makeRowWith(
  id: string,
  status: BrainWriteCandidateRow['status'],
  targetTier: BrainWriteCandidateRow['targetTier'],
): BrainWriteCandidateRow {
  return {
    id,
    status,
    targetTier,
    createdAt: new Date(),
  } as unknown as BrainWriteCandidateRow;
}

const fakeTx = {} as Parameters<typeof ratifyCurriculumForTenant>[0];
const NOW = new Date('2026-08-20T08:00:00Z');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ratifyCurriculumForTenant', () => {
  beforeEach(() => {
    mockListOpen.mockReset();
    mockRatify.mockReset();
    mockRatify.mockResolvedValue(makeRow('x'));
  });

  it('returns { ratified: 0, ids: [] } when no candidates are pending', async () => {
    mockListOpen.mockResolvedValue([]);
    const result = await ratifyCurriculumForTenant(fakeTx, 'actor', NOW);
    expect(result).toEqual({ ratified: 0, ids: [] });
    expect(mockRatify).not.toHaveBeenCalled();
  });

  it('ratifies every AWAITING_RATIFICATION L0_CONSTITUTION candidate', async () => {
    const rows = [makeRow('id-1'), makeRow('id-2'), makeRow('id-3')];
    mockListOpen.mockResolvedValue(rows);
    const result = await ratifyCurriculumForTenant(fakeTx, 'actor', NOW);
    expect(result.ratified).toBe(3);
    expect(result.ids).toEqual(['id-1', 'id-2', 'id-3']);
    expect(mockRatify).toHaveBeenCalledTimes(3);
  });

  it('passes ratifiedBy and now through to brain ratify', async () => {
    mockListOpen.mockResolvedValue([makeRow('id-1')]);
    await ratifyCurriculumForTenant(fakeTx, 'system-ratifier', NOW);
    expect(mockRatify).toHaveBeenCalledWith(fakeTx, 'id-1', 'system-ratifier', NOW);
  });

  it('skips candidates on tiers other than L0_CONSTITUTION', async () => {
    const rows = [
      makeRowWith('l1-node', 'AWAITING_RATIFICATION', 'L1_NODE'),
      makeRowWith('l3-proc', 'AWAITING_RATIFICATION', 'L3_PROCEDURE'),
      makeRow('l0-const'),
    ];
    mockListOpen.mockResolvedValue(rows);
    const result = await ratifyCurriculumForTenant(fakeTx, 'actor', NOW);
    expect(result.ratified).toBe(1);
    expect(result.ids).toEqual(['l0-const']);
  });

  it('skips L0_CONSTITUTION candidates not at AWAITING_RATIFICATION', async () => {
    const rows = [
      makeRowWith('cand-1', 'CANDIDATE', 'L0_CONSTITUTION'),
      makeRowWith('committed-1', 'COMMITTED', 'L0_CONSTITUTION'),
      makeRow('pending-1'),
    ];
    mockListOpen.mockResolvedValue(rows);
    const result = await ratifyCurriculumForTenant(fakeTx, 'actor', NOW);
    expect(result.ratified).toBe(1);
    expect(result.ids).toEqual(['pending-1']);
  });

  it('propagates an error from brain ratify without partial results', async () => {
    mockListOpen.mockResolvedValue([makeRow('id-1'), makeRow('id-2')]);
    mockRatify.mockRejectedValueOnce(new Error('write path error'));
    await expect(ratifyCurriculumForTenant(fakeTx, 'actor', NOW)).rejects.toThrow(
      'write path error',
    );
  });
});
