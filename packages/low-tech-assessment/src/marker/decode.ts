// Grid decoder: names the card and its orientation from an upright-view 5x5 bit grid, or says nothing.
//
// Safety property: a read is correct or absent. A wrong card or a wrong orientation is a wrong
// answer for a child, so a grid is accepted only when its nearest variant is within
// MAX_CORRECTABLE_BITS. All 400 variants are at least MARKER_MIN_DISTANCE (8) bits apart, so a
// grid within 2 bits of one variant is at least 6 bits from every other: the match is unique.

import type { CardSide } from '../cards.js';
import { hamming, rotateGrid } from './grid.js';
import { MARKER_PATTERNS } from './patterns.js';

/** Largest number of misread cells the decoder will correct. */
export const MAX_CORRECTABLE_BITS = 2;

/** Clockwise quarter turns of the canonical card, as seen upright. */
export type Rotation = 0 | 1 | 2 | 3;

export interface GridMatch {
  cardNumber: number;
  rotation: Rotation;
  side: CardSide;
  /** Number of cells that differed from the matched variant (0 to MAX_CORRECTABLE_BITS). */
  distance: number;
}

const GRID_MAX = (1 << 25) - 1;
const SIDES: readonly CardSide[] = ['A', 'D', 'C', 'B'];
const ROTATIONS: readonly Rotation[] = [0, 1, 2, 3];

// VARIANTS[card * 4 + rotation] is the grid of card (0-based) after that many clockwise turns.
const VARIANTS = new Uint32Array(MARKER_PATTERNS.length * 4);
MARKER_PATTERNS.forEach((pattern, card) => {
  let bits = pattern;
  for (let k = 0; k < 4; k += 1) {
    VARIANTS[card * 4 + k] = bits;
    bits = rotateGrid(bits);
  }
});

/** The side of the card at the top edge after `rotation` clockwise turns (canonical: A top, B right, C bottom, D left). */
export function sideForRotation(rotation: Rotation): CardSide {
  return SIDES[rotation] as CardSide;
}

/** Decode an upright-view 25-bit grid; null unless a variant is within MAX_CORRECTABLE_BITS. */
export function decodeGrid(bits: number): GridMatch | null {
  if (!Number.isInteger(bits) || bits < 0 || bits > GRID_MAX) {
    throw new RangeError(`bits must be an integer from 0 to ${GRID_MAX}`);
  }
  for (let i = 0; i < VARIANTS.length; i += 1) {
    const distance = hamming(bits, VARIANTS[i] as number);
    if (distance <= MAX_CORRECTABLE_BITS) {
      const rotation = ROTATIONS[i & 3] as Rotation;
      return {
        cardNumber: (i >>> 2) + 1,
        rotation,
        side: sideForRotation(rotation),
        distance,
      };
    }
  }
  return null;
}
