import { describe, expect, it } from 'vitest';
import type { CardSide } from '../src/cards.js';
import { cardBitmap } from '../src/marker/grid.js';
import { detectCards } from '../src/marker/detect.js';
import type { GrayFrame, MarkerReading } from '../src/marker/detect.js';
import { renderFrame } from './helpers/synth-frame.js';
import type { PlacedCard } from './helpers/synth-frame.js';

const SIDES: readonly CardSide[] = ['A', 'B', 'C', 'D'];
/**
 * CPU-bound tests that render and read hundreds of frames: about 0.9 s locally under v8 coverage,
 * and CI with coverage runs about 10x slower than that, past vitest's 5 s default.
 */
const CPU_HEAVY_TIMEOUT_MS = 60_000;

/** Pixel value at (x, y). */
const px = (frame: GrayFrame, x: number, y: number): number =>
  frame.data[y * frame.width + x] as number;

/** One card centred in a square frame with room for the quiet margin and some background. */
const single = (cardNumber: number, side: CardSide, cellPx: number): GrayFrame => {
  const size = 10 * cellPx;
  return renderFrame(size, size, [
    { cardNumber, side, centre: { x: size / 2, y: size / 2 }, sidePx: 7 * cellPx },
  ]);
};

/** The canonical bitmap after k clockwise quarter turns: cell (r, c) comes from the source cell that lands there. */
const turned = (cardNumber: number, k: number): boolean[][] => {
  const b = cardBitmap(cardNumber);
  const at = (r: number, c: number): boolean => b[r]?.[c] as boolean;
  return Array.from({ length: 7 }, (_, r) =>
    Array.from({ length: 7 }, (_unused, c) => {
      if (k === 1) return at(6 - c, r);
      if (k === 2) return at(6 - r, 6 - c);
      if (k === 3) return at(c, 6 - r);
      return at(r, c);
    }),
  );
};

describe('renderFrame (test helper)', () => {
  it('renderFrame puts a black border pixel at the card edge and a white pixel in the quiet margin', () => {
    // Card square spans x and y in [20, 90): cells of 10 px, margin [10, 20) and [90, 100).
    const frame = renderFrame(110, 110, [
      { cardNumber: 1, side: 'A', centre: { x: 55, y: 55 }, sidePx: 70 },
    ]);
    expect(frame.width).toBe(110);
    expect(frame.height).toBe(110);
    expect(frame.data).toBeInstanceOf(Uint8ClampedArray);
    expect(frame.data.length).toBe(110 * 110);
    // The four edges of the black border, at the outermost pixel row or column.
    expect(px(frame, 20, 55)).toBe(0);
    expect(px(frame, 89, 55)).toBe(0);
    expect(px(frame, 55, 20)).toBe(0);
    expect(px(frame, 55, 89)).toBe(0);
    // One pixel outside each edge: the white quiet margin.
    expect(px(frame, 19, 55)).toBe(255);
    expect(px(frame, 90, 55)).toBe(255);
    expect(px(frame, 55, 19)).toBe(255);
    expect(px(frame, 55, 90)).toBe(255);
    // The margin is exactly one cell wide; beyond it is the default background.
    expect(px(frame, 10, 55)).toBe(255);
    expect(px(frame, 9, 55)).toBe(200);
    expect(px(frame, 100, 100)).toBe(200);
    expect(px(frame, 0, 0)).toBe(200);
  });

  it('draws the requested side at the top by turning the canonical bitmap clockwise', () => {
    // Card 50 has an asymmetric pattern, so each quarter turn changes some cell centres.
    const sideTurns: readonly [CardSide, number][] = [
      ['A', 0],
      ['D', 1],
      ['C', 2],
      ['B', 3],
    ];
    for (const [side, k] of sideTurns) {
      const frame = renderFrame(110, 110, [
        { cardNumber: 50, side, centre: { x: 55, y: 55 }, sidePx: 70 },
      ]);
      const expected = turned(50, k);
      for (let r = 0; r < 7; r += 1) {
        for (let c = 0; c < 7; c += 1) {
          const value = px(frame, 20 + c * 10 + 5, 20 + r * 10 + 5);
          expect([side, r, c, value]).toEqual([side, r, c, expected[r]?.[c] ? 0 : 255]);
        }
      }
    }
    // The four sides render four different images.
    const centres = SIDES.map((side) =>
      Array.from(
        renderFrame(110, 110, [
          { cardNumber: 50, side, centre: { x: 55, y: 55 }, sidePx: 70 },
        ]).data,
      ).join(','),
    );
    expect(new Set(centres).size).toBe(4);
  });

  it('shortens the right edge under perspective tilt and turns the card by angleDeg', () => {
    // tiltDeg 30: width 70 cos 30 = 60.6, right edge 70 (1 - 0.4 sin 30) = 56 tall.
    const tilted = renderFrame(120, 120, [
      { cardNumber: 1, side: 'A', centre: { x: 60, y: 60 }, sidePx: 70, tiltDeg: 30 },
    ]);
    // Left border column at x = 60 - 30.3 + 2: dark the full 70 px height.
    expect(px(tilted, 32, 26)).toBe(0);
    expect(px(tilted, 32, 93)).toBe(0);
    // Right border column at x = 60 + 30.3 - 2: dark only within the 56 px right edge.
    expect(px(tilted, 88, 60 - 25)).toBe(0);
    expect(px(tilted, 88, 60 + 25)).toBe(0);
    expect(px(tilted, 88, 60 - 31)).toBeGreaterThan(200);
    expect(px(tilted, 88, 60 + 31)).toBeGreaterThan(200);
    // No longer 70 px wide: the pixel just inside the untilted right edge is past the border.
    expect(px(tilted, 92, 60)).toBe(255);

    // angleDeg 90 turns side A clockwise in the image, which draws what side D draws.
    const turnedA = renderFrame(110, 110, [
      { cardNumber: 50, side: 'A', centre: { x: 55, y: 55 }, sidePx: 70, angleDeg: 90 },
    ]);
    const sideD = turned(50, 1);
    for (let r = 0; r < 7; r += 1) {
      for (let c = 0; c < 7; c += 1) {
        expect(px(turnedA, 25 + c * 10, 25 + r * 10)).toBe(sideD[r]?.[c] ? 0 : 255);
      }
    }
  });

  it('applies contrast, glare, occluders, blur and seeded noise', () => {
    const card: PlacedCard = {
      cardNumber: 1,
      side: 'A',
      centre: { x: 55, y: 55 },
      sidePx: 70,
    };
    // Contrast maps black to low and white to high, linearly across the frame.
    const dim = renderFrame(110, 110, [card], { contrast: [90, 140], background: 255 });
    expect(px(dim, 20, 55)).toBe(90);
    expect(px(dim, 15, 55)).toBe(140);
    expect(px(dim, 0, 0)).toBe(140);
    // Glare adds `strength` at its centre (pixel 30's centre is 30.5) and nothing outside its radius.
    const glare = renderFrame(110, 110, [], {
      background: 100,
      glare: { cx: 30.5, cy: 30.5, radius: 20, strength: 60 },
    });
    expect(px(glare, 30, 30)).toBe(160);
    expect(px(glare, 30, 60)).toBe(100);
    expect(px(glare, 40, 30)).toBeGreaterThan(100);
    expect(px(glare, 40, 30)).toBeLessThan(160);
    // Occluders paint whole cells, addressed (col, row) on the card as drawn.
    const covered = renderFrame(110, 110, [card], {
      occlude: [
        {
          cardIndex: 0,
          cells: [
            [0, 0],
            [3, 2],
          ],
          value: 255,
        },
      ],
    });
    expect(px(covered, 25, 25)).toBe(255);
    expect(px(covered, 55, 45)).toBe(255);
    expect(px(covered, 35, 25)).toBe(0);
    // Blur softens a hard edge to an intermediate value and leaves flat areas alone.
    const blurred = renderFrame(110, 110, [card], { blurRadius: 2 });
    expect(px(blurred, 20, 55)).toBeGreaterThan(0);
    expect(px(blurred, 20, 55)).toBeLessThan(255);
    expect(px(blurred, 55, 20)).toBeGreaterThan(0);
    expect(px(blurred, 55, 20)).toBeLessThan(255);
    expect(px(blurred, 0, 0)).toBe(200);
    // Noise is reproducible from its seed, differs between seeds, and is centred on zero.
    const flat = { background: 128, noiseSigma: 12 };
    const a = renderFrame(64, 64, [], { ...flat, seed: 7 });
    const b = renderFrame(64, 64, [], { ...flat, seed: 7 });
    const c = renderFrame(64, 64, [], { ...flat, seed: 8 });
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
    expect(Array.from(a.data)).not.toEqual(Array.from(c.data));
    let sum = 0;
    let sumSq = 0;
    for (const v of a.data) {
      sum += v - 128;
      sumSq += (v - 128) ** 2;
    }
    const n = a.data.length;
    expect(Math.abs(sum / n)).toBeLessThan(1);
    expect(Math.sqrt(sumSq / n)).toBeGreaterThan(10.5);
    expect(Math.sqrt(sumSq / n)).toBeLessThan(13.5);
  });
});

describe('detectCards', () => {
  it(
    'reads every card 1 to 100 on all four sides',
    () => {
      for (let card = 1; card <= 100; card += 1) {
        for (const side of SIDES) {
          const readings = detectCards(single(card, side, 10));
          if (
            readings.length !== 1 ||
            readings[0]?.cardNumber !== card ||
            readings[0].side !== side ||
            readings[0].distance !== 0 ||
            readings[0].confidence !== 'high'
          ) {
            throw new Error(
              `card ${card} side ${side}: ${JSON.stringify(readings.map((r) => [r.cardNumber, r.side, r.distance, r.confidence]))}`,
            );
          }
        }
      }
    },
    CPU_HEAVY_TIMEOUT_MS,
  );

  it(
    'reads 12 chosen cards on all four sides at 24 px per cell',
    () => {
      for (const card of [1, 2, 7, 19, 20, 33, 50, 64, 77, 88, 99, 100]) {
        for (const side of SIDES) {
          const readings = detectCards(single(card, side, 24));
          expect(
            readings.map((r) => [r.cardNumber, r.side, r.distance, r.confidence]),
          ).toEqual([[card, side, 0, 'high']]);
        }
      }
    },
    CPU_HEAVY_TIMEOUT_MS,
  );

  it('reports centre and side length within 2 px', () => {
    const cases: readonly PlacedCard[] = [
      { cardNumber: 3, side: 'A', centre: { x: 70, y: 66 }, sidePx: 84 },
      { cardNumber: 41, side: 'C', centre: { x: 81.4, y: 73.7 }, sidePx: 91 },
      { cardNumber: 97, side: 'B', centre: { x: 75.5, y: 88.2 }, sidePx: 105 },
    ];
    for (const card of cases) {
      const [reading, ...rest] = detectCards(renderFrame(170, 180, [card]));
      expect(rest).toEqual([]);
      expect(reading).toMatchObject({ cardNumber: card.cardNumber, side: card.side });
      const r = reading as MarkerReading;
      expect(Math.abs(r.centre.x - card.centre.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(r.centre.y - card.centre.y)).toBeLessThanOrEqual(2);
      expect(Math.abs(r.sidePx - card.sidePx)).toBeLessThanOrEqual(2);
      expect(Math.abs(r.tiltDeg)).toBeLessThanOrEqual(1);
    }
    // Turned in the image plane: tiltDeg is the angle of the topmost edge, the side the one on top.
    const [turnedReading, ...others] = detectCards(
      renderFrame(170, 170, [
        { cardNumber: 12, side: 'D', centre: { x: 85, y: 85 }, sidePx: 91, angleDeg: 12 },
      ]),
    );
    expect(others).toEqual([]);
    expect(turnedReading).toMatchObject({
      cardNumber: 12,
      side: 'D',
      confidence: 'high',
    });
    const t = turnedReading as MarkerReading;
    expect(Math.abs(t.tiltDeg - 12)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(t.centre.x - 85)).toBeLessThanOrEqual(2);
    expect(Math.abs(t.centre.y - 85)).toBeLessThanOrEqual(2);
    expect(Math.abs(t.sidePx - 91)).toBeLessThanOrEqual(2);
  });

  it('reads nine different cards in one 640x360 frame', () => {
    const placed: PlacedCard[] = [];
    const numbers = [5, 18, 26, 37, 49, 58, 71, 83, 100];
    numbers.forEach((cardNumber, i) => {
      placed.push({
        cardNumber,
        side: SIDES[(i * 3 + 1) % 4] as CardSide,
        centre: { x: 110 + (i % 3) * 210, y: 60 + Math.floor(i / 3) * 120 },
        sidePx: 70,
      });
    });
    const readings = detectCards(renderFrame(640, 360, placed));
    const key = (n: number, s: string): string => `${n}${s}`;
    expect(new Set(readings.map((r) => key(r.cardNumber, r.side)))).toEqual(
      new Set(placed.map((p) => key(p.cardNumber, p.side))),
    );
    expect(readings).toHaveLength(9);
    // Sorted by centre.y, then centre.x.
    expect(readings.map((r) => r.cardNumber)).toEqual(numbers);
  });

  it('returns both readings when two learners hold the same card number', () => {
    // The nearer card (larger, right) starts higher in the image, so it is found first in raster
    // order, but its centre is lower: the readings must come back sorted by centre.y.
    const readings = detectCards(
      renderFrame(260, 130, [
        { cardNumber: 42, side: 'B', centre: { x: 180, y: 66 }, sidePx: 84 },
        { cardNumber: 42, side: 'C', centre: { x: 70, y: 62 }, sidePx: 70 },
      ]),
    );
    expect(
      readings.map((r) => [
        r.cardNumber,
        r.side,
        Math.round(r.centre.x),
        Math.round(r.centre.y),
      ]),
    ).toEqual([
      [42, 'C', 70, 62],
      [42, 'B', 180, 66],
    ]);
  });

  it('requires 22 of the 24 border cells to sample dark', () => {
    // Covering a run of top-border cells keeps the border one component with the same outline.
    const covered = (cells: readonly (readonly [number, number])[]): MarkerReading[] => [
      ...detectCards(
        renderFrame(
          110,
          110,
          [{ cardNumber: 61, side: 'A', centre: { x: 55, y: 55 }, sidePx: 70 }],
          { occlude: [{ cardIndex: 0, cells, value: 255 }] },
        ),
      ),
    ];
    const two = covered([
      [1, 0],
      [2, 0],
    ]);
    expect(two.map((r) => [r.cardNumber, r.side, r.distance])).toEqual([[61, 'A', 0]]);
    expect(
      covered([
        [1, 0],
        [2, 0],
        [3, 0],
      ]),
    ).toEqual([]);
  });

  it('returns [] for a blank frame', () => {
    expect(detectCards(renderFrame(200, 150, []))).toEqual([]);
    expect(detectCards({ width: 3, height: 2, data: new Uint8ClampedArray(6) })).toEqual(
      [],
    );
  });

  it('throws RangeError for a data length mismatch, a zero width and a fractional height', () => {
    expect(() =>
      detectCards({ width: 4, height: 4, data: new Uint8ClampedArray(15) }),
    ).toThrow(new RangeError('data length must equal width * height'));
    expect(() =>
      detectCards({ width: 0, height: 4, data: new Uint8ClampedArray(0) }),
    ).toThrow(new RangeError('width must be a positive integer'));
    expect(() =>
      detectCards({ width: 4, height: 2.5, data: new Uint8ClampedArray(10) }),
    ).toThrow(new RangeError('height must be a positive integer'));
  });
});
