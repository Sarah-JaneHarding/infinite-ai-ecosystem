import { describe, expect, it } from 'vitest';

import {
  WRITE_PATH_ORDER,
  decideContradiction,
  nextStatus,
  requiresRatification,
  type BrainWriteStatus,
} from '../src/write-path-state-machine.js';

describe('requiresRatification', () => {
  it('is true for L0_CONSTITUTION and L3_PROCEDURE', () => {
    expect(requiresRatification('L0_CONSTITUTION')).toBe(true);
    expect(requiresRatification('L3_PROCEDURE')).toBe(true);
  });

  it('is false for every other tier', () => {
    expect(requiresRatification('L1_NODE')).toBe(false);
    expect(requiresRatification('L1_EDGE')).toBe(false);
    expect(requiresRatification('L2_EPISODE')).toBe(false);
  });
});

describe('nextStatus', () => {
  it("follows the manual's own order for a ratified tier (L0_CONSTITUTION)", () => {
    const path: BrainWriteStatus[] = ['CANDIDATE'];
    let current: BrainWriteStatus | null = 'CANDIDATE';
    while (current !== null) {
      current = nextStatus(current, 'L0_CONSTITUTION');
      if (current !== null) path.push(current);
    }
    expect(path).toEqual([
      'CANDIDATE',
      'EXTRACTED',
      'CONTRADICTION_CHECKED',
      'PROVENANCE_STAMPED',
      'AWAITING_RATIFICATION',
      'COMMITTED',
      'INDEXED',
      'RETENTION_SCHEDULED',
    ]);
  });

  it('skips AWAITING_RATIFICATION for an unratified tier (L1_NODE)', () => {
    expect(nextStatus('PROVENANCE_STAMPED', 'L1_NODE')).toBe('COMMITTED');
  });

  it('is null once RETENTION_SCHEDULED — the pipeline has no step after its last one', () => {
    expect(nextStatus('RETENTION_SCHEDULED', 'L1_NODE')).toBeNull();
  });

  it("never produces a status outside the manual's own list, for any tier", () => {
    const tiers = [
      'L0_CONSTITUTION',
      'L1_NODE',
      'L1_EDGE',
      'L2_EPISODE',
      'L3_PROCEDURE',
    ] as const;
    for (const tier of tiers) {
      for (const status of WRITE_PATH_ORDER) {
        const next = nextStatus(status, tier);
        if (next !== null) expect(WRITE_PATH_ORDER).toContain(next);
      }
    }
  });
});

describe('decideContradiction', () => {
  it('finds no contradiction when nothing effective exists yet', () => {
    expect(decideContradiction(null, null)).toEqual({ contradictionOf: null });
  });

  it('finds no contradiction when the candidate declares exactly what it supersedes', () => {
    expect(decideContradiction('row-1', { id: 'row-1' })).toEqual({
      contradictionOf: null,
    });
  });

  it('flags a contradiction when an effective row exists and nothing declared it', () => {
    expect(decideContradiction(null, { id: 'row-1' })).toEqual({
      contradictionOf: 'row-1',
    });
  });

  it('flags a contradiction when the candidate declares a different row than the one effective now', () => {
    expect(decideContradiction('row-0', { id: 'row-1' })).toEqual({
      contradictionOf: 'row-1',
    });
  });
});
