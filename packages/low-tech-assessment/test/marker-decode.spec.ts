import { describe, expect, it } from 'vitest';
import { rotateGrid } from '../src/marker/grid.js';
import { MARKER_PATTERNS } from '../src/marker/patterns.js';
import {
  decodeGrid,
  MAX_CORRECTABLE_BITS,
  sideForRotation,
} from '../src/marker/decode.js';
import type { Rotation } from '../src/marker/decode.js';

const ROTATIONS: readonly Rotation[] = [0, 1, 2, 3];
const RANGE_MESSAGE = 'bits must be an integer from 0 to 33554431';

/** The true upright-view grid of card `cardNumber` after `rotation` clockwise quarter turns. */
const variant = (cardNumber: number, rotation: Rotation): number => {
  let bits = MARKER_PATTERNS[cardNumber - 1] as number;
  for (let k = 0; k < rotation; k += 1) bits = rotateGrid(bits);
  return bits;
};

/** Small seeded PRNG so the sampled tests are reproducible. */
const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** `count` distinct bit positions out of 25, chosen with `next`. */
const pickBits = (next: () => number, count: number): number[] => {
  const positions: number[] = [];
  while (positions.length < count) {
    const p = Math.floor(next() * 25);
    if (!positions.includes(p)) positions.push(p);
  }
  return positions;
};

const flip = (bits: number, positions: readonly number[]): number =>
  positions.reduce((acc, p) => (acc ^ (1 << p)) >>> 0, bits);

describe('decodeGrid', () => {
  it('decodes every card in every rotation with distance 0', () => {
    expect(MAX_CORRECTABLE_BITS).toBe(2);
    for (let card = 1; card <= 100; card += 1) {
      for (const rotation of ROTATIONS) {
        expect(decodeGrid(variant(card, rotation))).toEqual({
          cardNumber: card,
          rotation,
          side: sideForRotation(rotation),
          distance: 0,
        });
      }
    }
  });

  it('sideForRotation maps 0,1,2,3 to A,D,C,B', () => {
    expect(ROTATIONS.map(sideForRotation)).toEqual(['A', 'D', 'C', 'B']);
  });

  // CPU-bound by design; the timeout is explicit because coverage on CI runs about 10x slower.
  it('corrects every 1-bit and 2-bit flip to the same card and rotation', () => {
    for (let card = 1; card <= 100; card += 1) {
      for (const rotation of ROTATIONS) {
        const truth = variant(card, rotation);
        for (let i = 0; i < 25; i += 1) {
          const one = decodeGrid(flip(truth, [i]));
          expect(one).toMatchObject({ cardNumber: card, rotation, distance: 1 });
          for (let j = i + 1; j < 25; j += 1) {
            const two = decodeGrid(flip(truth, [i, j]));
            if (
              two === null ||
              two.cardNumber !== card ||
              two.rotation !== rotation ||
              two.distance !== 2
            ) {
              throw new Error(
                `card ${card} rot ${rotation} flips ${i},${j}: ${JSON.stringify(two)}`,
              );
            }
          }
        }
      }
    }
  }, 60_000);

  // CPU-bound by design; the timeout is explicit because coverage on CI runs about 10x slower.
  it('never returns a different card for 60 000 seeded 3-bit flips', () => {
    const next = mulberry32(3);
    let accepted = 0;
    for (let n = 0; n < 60_000; n += 1) {
      const card = (n % 100) + 1;
      const rotation = ROTATIONS[Math.floor(n / 100) % 4] as Rotation;
      const result = decodeGrid(flip(variant(card, rotation), pickBits(next, 3)));
      if (result !== null) {
        accepted += 1;
        expect(result.cardNumber).toBe(card);
        expect(result.rotation).toBe(rotation);
      }
    }
    // Variants are at least 8 apart, so a 3-bit flip is never within 2 of any other variant and
    // always lands exactly 3 from its own: every one of them must be rejected.
    expect(accepted).toBe(0);
  }, 60_000);

  // CPU-bound by design; the timeout is explicit because coverage on CI runs about 10x slower.
  it('never returns a different card or rotation for 20 000 seeded 4-bit and 5-bit flips', () => {
    const next = mulberry32(45);
    for (let n = 0; n < 20_000; n += 1) {
      const card = (n % 100) + 1;
      const rotation = ROTATIONS[Math.floor(n / 100) % 4] as Rotation;
      const flips = n % 2 === 0 ? 4 : 5;
      const result = decodeGrid(flip(variant(card, rotation), pickBits(next, flips)));
      if (result !== null) {
        expect(result.cardNumber).toBe(card);
        expect(result.rotation).toBe(rotation);
      }
    }
  }, 60_000);

  it('returns null for the all-white and all-black grids', () => {
    expect(decodeGrid(0)).toBeNull();
    expect(decodeGrid(0x1ffffff)).toBeNull();
  });

  it('throws RangeError for a negative, fractional or oversize value', () => {
    for (const bad of [-1, 1.5, 0x2000000, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => decodeGrid(bad)).toThrow(new RangeError(RANGE_MESSAGE));
    }
  });
});
