import { describe, expect, it } from 'vitest';
import { MAX_CARDS } from '../src/cards.js';
import {
  cardBitmap,
  CARD_CELLS,
  GRID,
  hamming,
  patternFor,
  rotateGrid,
} from '../src/marker/grid.js';
import { generatePatterns, PATTERN_SEARCH } from '../src/marker/generate.js';
import { MARKER_MIN_DISTANCE, MARKER_PATTERNS } from '../src/marker/patterns.js';

const popcount = (v: number): number => {
  let n = 0;
  for (let x = v; x > 0; x >>>= 1) n += x & 1;
  return n;
};

const variantsOf = (p: number): number[] => {
  const out = [p];
  for (let k = 1; k < 4; k += 1) out.push(rotateGrid(out[k - 1] as number));
  return out;
};

describe('grid helpers', () => {
  it('exposes the grid sizes', () => {
    expect(GRID).toBe(5);
    expect(CARD_CELLS).toBe(7);
  });

  it('rotateGrid four times returns the input', () => {
    for (const v of [1, 0b10110, 0x1ffffff, 0x155aaaa, 12345, 0]) {
      expect(rotateGrid(rotateGrid(rotateGrid(rotateGrid(v))))).toBe(v);
    }
  });

  it('rotateGrid moves the top-left cell to the top-right', () => {
    expect(rotateGrid(1)).toBe(1 << 4);
  });

  it('hamming counts differing bits', () => {
    expect(hamming(0, 0)).toBe(0);
    expect(hamming(0b1010, 0b0110)).toBe(2);
    expect(hamming(0, 0x1ffffff)).toBe(25);
  });
});

describe('MARKER_PATTERNS', () => {
  it('has MAX_CARDS entries, each within 25 bits with 8 to 17 black cells', () => {
    expect(MARKER_PATTERNS).toHaveLength(MAX_CARDS);
    for (const p of MARKER_PATTERNS) {
      expect(Number.isInteger(p)).toBe(true);
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(1 << 25);
      expect(popcount(p)).toBeGreaterThanOrEqual(8);
      expect(popcount(p)).toBeLessThanOrEqual(17);
    }
  });

  it('all 400 rotation variants are at least MARKER_MIN_DISTANCE apart', () => {
    const all = MARKER_PATTERNS.flatMap(variantsOf);
    expect(all).toHaveLength(400);
    let min = Infinity;
    for (let i = 0; i < all.length; i += 1) {
      for (let j = i + 1; j < all.length; j += 1) {
        min = Math.min(min, hamming(all[i] as number, all[j] as number));
      }
    }
    expect(min).toBeGreaterThanOrEqual(MARKER_MIN_DISTANCE);
  });

  it('MARKER_MIN_DISTANCE is 8', () => {
    expect(MARKER_MIN_DISTANCE).toBe(8);
    expect(MARKER_MIN_DISTANCE).toBe(PATTERN_SEARCH.minDistance);
  });

  it('regenerates identically from PATTERN_SEARCH', () => {
    expect(generatePatterns(PATTERN_SEARCH)).toEqual(MARKER_PATTERNS);
  }, 30_000);
});

describe('generatePatterns validation', () => {
  const base = { count: 3, minDistance: 4, minBlack: 8, maxBlack: 17 };

  it('rejects count 0, minDistance 0, minBlack above maxBlack, and exhausted maxCandidates (50)', () => {
    // Tight budget: a missing guard hits the exhaustion error (wrong message) instead of hanging.
    const tight = { ...base, maxCandidates: 50 };
    expect(() => generatePatterns({ ...tight, count: 0 })).toThrow(
      /count must be at least 1/,
    );
    expect(() => generatePatterns({ ...tight, minDistance: 0 })).toThrow(
      /minDistance must be at least 1/,
    );
    expect(() => generatePatterns({ ...tight, minBlack: 18 })).toThrow(
      /minBlack must not exceed maxBlack/,
    );
    expect(() => generatePatterns({ ...tight, count: 100 })).toThrow(
      /found only \d+ of 100 patterns within 50 candidates/,
    );
  });

  it('generates a small set deterministically', () => {
    const a = generatePatterns(base);
    expect(a).toHaveLength(3);
    expect(generatePatterns(base)).toEqual(a);
  });
});

describe('patternFor and cardBitmap', () => {
  it('patternFor maps card numbers to table entries and rejects out of range', () => {
    expect(patternFor(1)).toBe(MARKER_PATTERNS[0]);
    expect(patternFor(MAX_CARDS)).toBe(MARKER_PATTERNS[MAX_CARDS - 1]);
    expect(() => patternFor(0)).toThrow(RangeError);
    expect(() => patternFor(MAX_CARDS + 1)).toThrow(RangeError);
    expect(() => patternFor(1.5)).toThrow(RangeError);
  });

  it('border ring is black, data cells equal the pattern bits, and it throws for 0 and 101', () => {
    const bitmap = cardBitmap(7);
    const pattern = patternFor(7);
    expect(bitmap).toHaveLength(7);
    for (let r = 0; r < 7; r += 1) {
      expect(bitmap[r]).toHaveLength(7);
      for (let c = 0; c < 7; c += 1) {
        const border = r === 0 || r === 6 || c === 0 || c === 6;
        const expected = border ? true : ((pattern >> ((r - 1) * 5 + (c - 1))) & 1) === 1;
        expect(bitmap[r]?.[c]).toBe(expected);
      }
    }
    expect(() => cardBitmap(0)).toThrow(RangeError);
    expect(() => cardBitmap(101)).toThrow(RangeError);
  });
});
