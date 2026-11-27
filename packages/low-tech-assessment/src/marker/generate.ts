// Deterministic search for card patterns. The committed table in patterns.ts is the output of
// generatePatterns(PATTERN_SEARCH); a test regenerates it and compares.

import { hamming, popcount, rotateGrid } from './grid.js';

export interface PatternSearch {
  count: number;
  minDistance: number;
  minBlack: number;
  maxBlack: number;
  maxCandidates?: number;
}

export const PATTERN_SEARCH: PatternSearch = {
  count: 100,
  minDistance: 8,
  minBlack: 8,
  maxBlack: 17,
};

const DEFAULT_MAX_CANDIDATES = 2 ** 25;

/**
 * Greedy search: scan candidates ascending from 1, keep those whose black-cell count is in range
 * and whose four rotations are mutually, and against every previously kept variant, at least
 * minDistance bits apart.
 */
export function generatePatterns(search: PatternSearch): readonly number[] {
  const { count, minDistance, minBlack, maxBlack } = search;
  const maxCandidates = search.maxCandidates ?? DEFAULT_MAX_CANDIDATES;
  if (count < 1) throw new RangeError('count must be at least 1');
  if (minDistance < 1) throw new RangeError('minDistance must be at least 1');
  if (minBlack > maxBlack) throw new RangeError('minBlack must not exceed maxBlack');

  const accepted: number[] = [];
  for (let candidate = 1; candidate <= maxCandidates; candidate += 1) {
    const black = popcount(candidate);
    if (black < minBlack || black > maxBlack) continue;

    const r1 = rotateGrid(candidate);
    const r2 = rotateGrid(r1);
    const r3 = rotateGrid(r2);
    if (
      hamming(candidate, r1) < minDistance ||
      hamming(candidate, r2) < minDistance ||
      hamming(candidate, r3) < minDistance ||
      hamming(r1, r2) < minDistance ||
      hamming(r1, r3) < minDistance ||
      hamming(r2, r3) < minDistance
    ) {
      continue;
    }

    // Rotation preserves Hamming distance, so every rotation of an accepted pattern is at least
    // minDistance from every rotation of the candidate exactly when the accepted pattern itself
    // is at least minDistance from each of the candidate's four rotations. Comparing against the
    // accepted base patterns alone is therefore equivalent to comparing against all their variants.
    // Newest first: recent patterns reject most candidates, which ends the scan early.
    let ok = true;
    for (let v = accepted.length - 1; v >= 0; v -= 1) {
      const w = accepted[v] as number;
      if (
        hamming(w, candidate) < minDistance ||
        hamming(w, r1) < minDistance ||
        hamming(w, r2) < minDistance ||
        hamming(w, r3) < minDistance
      ) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    accepted.push(candidate);
    if (accepted.length === count) return accepted;
  }
  throw new RangeError(
    `found only ${accepted.length} of ${count} patterns within ${maxCandidates} candidates`,
  );
}
