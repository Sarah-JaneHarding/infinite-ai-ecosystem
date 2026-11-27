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
  const variants: number[] = [];
  for (let candidate = 1; candidate <= maxCandidates; candidate += 1) {
    const black = popcount(candidate);
    if (black < minBlack || black > maxBlack) continue;

    const rotations = [candidate];
    for (let k = 1; k < 4; k += 1) rotations.push(rotateGrid(rotations[k - 1] as number));

    let ok = true;
    for (let i = 0; i < 4 && ok; i += 1) {
      for (let j = i + 1; j < 4; j += 1) {
        if (hamming(rotations[i] as number, rotations[j] as number) < minDistance) {
          ok = false;
          break;
        }
      }
    }
    for (let v = 0; ok && v < variants.length; v += 1) {
      for (const r of rotations) {
        if (hamming(variants[v] as number, r) < minDistance) {
          ok = false;
          break;
        }
      }
    }
    if (!ok) continue;

    accepted.push(candidate);
    variants.push(...rotations);
    if (accepted.length === count) return accepted;
  }
  throw new RangeError(
    `found only ${accepted.length} of ${count} patterns within ${maxCandidates} candidates`,
  );
}
