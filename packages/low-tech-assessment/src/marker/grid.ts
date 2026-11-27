// Bit-grid helpers for the 5x5 card marker.
// Bit convention: bit i = row * 5 + col, row 0 at the top, col 0 at the left, 1 = black.

import { MAX_CARDS } from '../cards.js';
import { MARKER_PATTERNS } from './patterns.js';

/** Side of the data grid, in cells. */
export const GRID = 5;
/** Side of the printed marker (data grid plus a one-cell black border), in cells. */
export const CARD_CELLS = 7;

/** Reference rotation, one cell at a time; used only to build the lookup tables below. */
function rotateCells(bits: number): number {
  let out = 0;
  for (let r = 0; r < GRID; r += 1) {
    for (let c = 0; c < GRID; c += 1) {
      if (((bits >>> (r * GRID + c)) & 1) === 1) {
        out |= 1 << (c * GRID + (GRID - 1 - r));
      }
    }
  }
  return out >>> 0;
}

// Rotation is a bit permutation, so it distributes over OR: rotating the low 13 bits and the high
// 12 bits separately and OR-ing the results equals rotating the whole grid.
const LOW_BITS = 13;
const LOW_MASK = (1 << LOW_BITS) - 1;
const ROTATE_LOW = new Uint32Array(1 << LOW_BITS);
const ROTATE_HIGH = new Uint32Array(1 << (GRID * GRID - LOW_BITS));
for (let i = 0; i < ROTATE_LOW.length; i += 1) ROTATE_LOW[i] = rotateCells(i);
for (let i = 0; i < ROTATE_HIGH.length; i += 1)
  ROTATE_HIGH[i] = rotateCells(i << LOW_BITS);

const POPCOUNT_16 = new Uint8Array(1 << 16);
for (let i = 1; i < POPCOUNT_16.length; i += 1) {
  POPCOUNT_16[i] = (POPCOUNT_16[i >>> 1] as number) + (i & 1);
}

/** Rotate a 5x5 bit grid 90 degrees clockwise: (row r, col c) moves to (row c, col 4 - r). */
export function rotateGrid(bits: number): number {
  return (
    ((ROTATE_LOW[bits & LOW_MASK] as number) |
      (ROTATE_HIGH[(bits >>> LOW_BITS) & 0xfff] as number)) >>>
    0
  );
}

/** Number of set bits in a 32-bit value. */
export function popcount(value: number): number {
  const x = value >>> 0;
  return (POPCOUNT_16[x & 0xffff] as number) + (POPCOUNT_16[x >>> 16] as number);
}

/** Number of differing bits between two grids. */
export function hamming(a: number, b: number): number {
  return popcount((a ^ b) >>> 0);
}

function assertCardNumber(cardNumber: number): void {
  if (!Number.isInteger(cardNumber) || cardNumber < 1 || cardNumber > MAX_CARDS) {
    throw new RangeError(`cardNumber must be an integer from 1 to ${MAX_CARDS}`);
  }
}

/** The 25-bit data pattern for a card. */
export function patternFor(cardNumber: number): number {
  assertCardNumber(cardNumber);
  return MARKER_PATTERNS[cardNumber - 1] as number;
}

/** The 7x7 marker for a card: row 0 on top, black border ring, data cells from the pattern. */
export function cardBitmap(cardNumber: number): readonly (readonly boolean[])[] {
  const pattern = patternFor(cardNumber);
  const rows: boolean[][] = [];
  for (let r = 0; r < CARD_CELLS; r += 1) {
    const row: boolean[] = [];
    for (let c = 0; c < CARD_CELLS; c += 1) {
      const border = r === 0 || c === 0 || r === CARD_CELLS - 1 || c === CARD_CELLS - 1;
      row.push(border || ((pattern >>> ((r - 1) * GRID + (c - 1))) & 1) === 1);
    }
    rows.push(row);
  }
  return rows;
}
