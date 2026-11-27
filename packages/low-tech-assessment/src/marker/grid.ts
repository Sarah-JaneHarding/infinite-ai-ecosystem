// Bit-grid helpers for the 5x5 card marker.
// Bit convention: bit i = row * 5 + col, row 0 at the top, col 0 at the left, 1 = black.

import { MAX_CARDS } from '../cards.js';
import { MARKER_PATTERNS } from './patterns.js';

/** Side of the data grid, in cells. */
export const GRID = 5;
/** Side of the printed marker (data grid plus a one-cell black border), in cells. */
export const CARD_CELLS = 7;

/** Rotate a 5x5 bit grid 90 degrees clockwise: (row r, col c) moves to (row c, col 4 - r). */
export function rotateGrid(bits: number): number {
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

/** Number of set bits in a 32-bit value. */
export function popcount(value: number): number {
  let x = value >>> 0;
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
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
