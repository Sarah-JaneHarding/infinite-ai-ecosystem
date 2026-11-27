// Test-only synthetic camera frames. Deliberately independent of src/marker/detect.ts: it draws
// cards from cardBitmap with its own geometry, so a detector bug cannot hide behind a shared one.
//
// Geometry: each card is the 7-cell square plus a 1-cell white quiet margin. In card-local cell
// units (u right, v down, 0 to 7 across the square) the square maps to the image through one
// projective transform, so the margin follows the same perspective as the card.

import type { CardSide } from '../../src/cards.js';
import { cardBitmap } from '../../src/marker/grid.js';

export interface GrayFrame {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export interface PlacedCard {
  cardNumber: number;
  /** The side drawn at the top of the card before angleDeg turns it. */
  side: CardSide;
  centre: { x: number; y: number };
  /** Side of the 7-cell square in pixels (before tilt). */
  sidePx: number;
  /** In-plane turn, clockwise as seen in the image. */
  angleDeg?: number;
  /** Perspective: the right edge is shortened to (1 - 0.4 sin t) of the left, width scaled by cos t. */
  tiltDeg?: number;
}

export interface Impairments {
  /** Background grey level; default 200. */
  background?: number;
  /** Separable box blur radius in pixels (rounded); default none. */
  blurRadius?: number;
  /** Standard deviation of additive Gaussian noise; default none. */
  noiseSigma?: number;
  /** Noise seed for mulberry32; default 1. */
  seed?: number;
  /** Adds strength * (1 - d / radius) within radius of (cx, cy), measured to pixel centres. */
  glare?: { cx: number; cy: number; radius: number; strength: number };
  /** Paints whole cells (col, row of the 7x7 square, as drawn before angleDeg) of card cardIndex. */
  occlude?: readonly {
    cardIndex: number;
    cells: readonly (readonly [col: number, row: number])[];
    value: 0 | 255;
  }[];
  /** Linear remap of the whole frame: 0 becomes low and 255 becomes high. */
  contrast?: readonly [low: number, high: number];
}

const CELLS = 7;
/** Side at the top after k clockwise quarter turns of the canonical card. */
const SIDE_AT_TOP: readonly CardSide[] = ['A', 'D', 'C', 'B'];
/** Sub-samples per pixel axis (2 x 2 anti-aliasing). */
const SUB = 2;
/** The square plus its quiet margin, in cells. */
const BLOCK = CELLS + 2;

/** Seeded PRNG in [0, 1). */
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

/** The card's 7x7 cells after k clockwise quarter turns: (r, c) comes from source (6 - c, r). */
const turnedBitmap = (cardNumber: number, k: number): boolean[][] => {
  let cells = cardBitmap(cardNumber).map((row) => [...row]);
  for (let t = 0; t < k; t += 1) {
    const src = cells;
    cells = Array.from({ length: CELLS }, (_, r) =>
      Array.from({ length: CELLS }, (_unused, c) => src[CELLS - 1 - c]?.[r] === true),
    );
  }
  return cells;
};

type Matrix = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

/** Projective map of the unit square (0,0),(1,0),(1,1),(0,1) onto quad p0..p3 (Heckbert). */
const squareToQuad = (q: readonly (readonly [number, number])[]): Matrix => {
  const [x0, y0] = q[0] as readonly [number, number];
  const [x1, y1] = q[1] as readonly [number, number];
  const [x2, y2] = q[2] as readonly [number, number];
  const [x3, y3] = q[3] as readonly [number, number];
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;
  return [
    x1 - x0 + g * x1,
    x3 - x0 + h * x3,
    x0,
    y1 - y0 + g * y1,
    y3 - y0 + h * y3,
    y0,
    g,
    h,
    1,
  ];
};

const invert = (m: Matrix): Matrix => {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = c * h - b * i;
  const C = b * f - c * e;
  const D = f * g - d * i;
  const E = a * i - c * g;
  const F = c * d - a * f;
  const G = d * h - e * g;
  const H = b * g - a * h;
  const I = a * e - b * d;
  const det = a * A + b * D + c * G;
  return [
    A / det,
    B / det,
    C / det,
    D / det,
    E / det,
    F / det,
    G / det,
    H / det,
    I / det,
  ];
};

const apply = (m: Matrix, x: number, y: number): [number, number] => {
  const w = m[6] * x + m[7] * y + m[8];
  return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w];
};

/**
 * Index into the 9 x 9 block of the cell under image point (x, y), or -1 outside the block.
 * `m` maps image points to unit-square coordinates of the 7-cell square.
 */
const regionAt = (m: Float64Array, x: number, y: number): number => {
  const w = (m[6] as number) * x + (m[7] as number) * y + (m[8] as number);
  const u =
    (CELLS * ((m[0] as number) * x + (m[1] as number) * y + (m[2] as number))) / w;
  const v =
    (CELLS * ((m[3] as number) * x + (m[4] as number) * y + (m[5] as number))) / w;
  if (u < -1 || u >= CELLS + 1 || v < -1 || v >= CELLS + 1) return -1;
  return (Math.floor(v) + 1) * BLOCK + Math.floor(u) + 1;
};

/** Image corners of the 7-cell square: top-left, top-right, bottom-right, bottom-left. */
const cardCorners = (card: PlacedCard): [number, number][] => {
  const t = ((card.tiltDeg ?? 0) * Math.PI) / 180;
  const a = ((card.angleDeg ?? 0) * Math.PI) / 180;
  const half = card.sidePx / 2;
  const halfW = half * Math.cos(t);
  const halfRight = half * (1 - 0.4 * Math.sin(t));
  const local: [number, number][] = [
    [-halfW, -half],
    [halfW, -halfRight],
    [halfW, halfRight],
    [-halfW, half],
  ];
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return local.map(([x, y]) => [
    card.centre.x + x * cos - y * sin,
    card.centre.y + x * sin + y * cos,
  ]);
};

const drawCard = (
  buf: Float64Array,
  width: number,
  height: number,
  card: PlacedCard,
  covers: readonly { cells: readonly (readonly [number, number])[]; value: 0 | 255 }[],
): void => {
  const k = SIDE_AT_TOP.indexOf(card.side);
  const cells = turnedBitmap(card.cardNumber, k);
  // The 9 x 9 block, row-major: the margin ring white, the 7 x 7 square 0 black or 255 white,
  // with occluders painted over.
  const block = new Float64Array(BLOCK * BLOCK).fill(255);
  for (let r = 0; r < CELLS; r += 1) {
    for (let c = 0; c < CELLS; c += 1) {
      block[(r + 1) * BLOCK + c + 1] = cells[r]?.[c] === true ? 0 : 255;
    }
  }
  for (const cover of covers) {
    for (const [col, row] of cover.cells) {
      if (col >= 0 && col < CELLS && row >= 0 && row < CELLS) {
        block[(row + 1) * BLOCK + col + 1] = cover.value;
      }
    }
  }
  // Cell units: u, v in [0, 7] span the square; the margin is [-1, 8].
  const toImage = squareToQuad(cardCorners(card));
  const inverse = invert(toImage);
  const fromImage = new Float64Array(inverse);
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (const [u, v] of [
    [-1, -1],
    [8, -1],
    [8, 8],
    [-1, 8],
  ] as const) {
    const [x, y] = apply(toImage, u / CELLS, v / CELLS);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const x0 = Math.max(0, Math.floor(minX));
  const y0 = Math.max(0, Math.floor(minY));
  const x1 = Math.min(width - 1, Math.ceil(maxX));
  const y1 = Math.min(height - 1, Math.ceil(maxY));
  // Regions of the pixel-corner lattice, one row above (`upper`) and one below (`lower`) each
  // pixel row. Every block cell is convex in the image (a projective map keeps lines straight),
  // so a pixel whose four corners share a cell lies wholly inside it and needs no sub-sampling.
  // A pixel whose corners are all outside the block is left as background; it can differ from a
  // full sub-sample only where one of the block's four outer corners pokes into it.
  const cols = x1 - x0 + 2;
  const [f0, f1, f2, f3, f4, f5, f6, f7, f8] = inverse;
  let upper = new Int16Array(cols);
  let lower = new Int16Array(cols);
  for (let x = x0; x <= x1 + 1; x += 1) upper[x - x0] = regionAt(fromImage, x, y0);
  const n = SUB * SUB;
  for (let y = y0; y <= y1; y += 1) {
    // regionAt, inlined for the one call per pixel.
    const ly = y + 1;
    for (let x = x0; x <= x1 + 1; x += 1) {
      const w = f6 * x + f7 * ly + f8;
      const u = (CELLS * (f0 * x + f1 * ly + f2)) / w;
      const v = (CELLS * (f3 * x + f4 * ly + f5)) / w;
      lower[x - x0] =
        u < -1 || u >= CELLS + 1 || v < -1 || v >= CELLS + 1
          ? -1
          : (Math.floor(v) + 1) * BLOCK + Math.floor(u) + 1;
    }
    for (let x = x0; x <= x1; x += 1) {
      const j = x - x0;
      const region = upper[j] as number;
      const i = y * width + x;
      if (region === upper[j + 1] && region === lower[j] && region === lower[j + 1]) {
        if (region >= 0) buf[i] = block[region] as number;
        continue;
      }
      let inside = 0;
      let total = 0;
      for (let sy = 0; sy < SUB; sy += 1) {
        for (let sx = 0; sx < SUB; sx += 1) {
          const sample = regionAt(fromImage, x + (sx + 0.5) / SUB, y + (sy + 0.5) / SUB);
          if (sample < 0) continue;
          inside += 1;
          total += block[sample] as number;
        }
      }
      buf[i] = ((buf[i] as number) * (n - inside) + total) / n;
    }
    [upper, lower] = [lower, upper];
  }
};

/** Box blur along one axis with edge clamping. */
const boxBlur = (
  src: Float64Array,
  width: number,
  height: number,
  r: number,
  horizontal: boolean,
): Float64Array => {
  const out = new Float64Array(src.length);
  const len = horizontal ? width : height;
  const lines = horizontal ? height : width;
  for (let line = 0; line < lines; line += 1) {
    for (let p = 0; p < len; p += 1) {
      let sum = 0;
      for (let d = -r; d <= r; d += 1) {
        const q = Math.min(len - 1, Math.max(0, p + d));
        sum += src[horizontal ? line * width + q : q * width + line] as number;
      }
      out[horizontal ? line * width + p : p * width + line] = sum / (2 * r + 1);
    }
  }
  return out;
};

/**
 * Render a grayscale frame (0 = black). Order: background and cards, contrast remap, glare, blur,
 * noise, then round and clamp.
 */
export function renderFrame(
  width: number,
  height: number,
  cards: readonly PlacedCard[],
  impairments: Impairments = {},
): GrayFrame {
  let buf: Float64Array = new Float64Array(width * height).fill(
    impairments.background ?? 200,
  );
  cards.forEach((card, index) => {
    const covers = (impairments.occlude ?? []).filter((o) => o.cardIndex === index);
    drawCard(buf, width, height, card, covers);
  });
  if (impairments.contrast !== undefined) {
    const [low, high] = impairments.contrast;
    for (let i = 0; i < buf.length; i += 1)
      buf[i] = low + ((buf[i] as number) * (high - low)) / 255;
  }
  const glare = impairments.glare;
  if (glare !== undefined) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const d = Math.hypot(x + 0.5 - glare.cx, y + 0.5 - glare.cy);
        if (d < glare.radius) {
          const i = y * width + x;
          buf[i] = (buf[i] as number) + glare.strength * (1 - d / glare.radius);
        }
      }
    }
  }
  const r = Math.round(impairments.blurRadius ?? 0);
  if (r > 0) {
    buf = boxBlur(boxBlur(buf, width, height, r, true), width, height, r, false);
  }
  const sigma = impairments.noiseSigma ?? 0;
  if (sigma > 0) {
    const next = mulberry32(impairments.seed ?? 1);
    for (let i = 0; i < buf.length; i += 1) {
      // Box-Muller; 1 - next() keeps the logarithm's argument in (0, 1].
      const z = Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
      buf[i] = (buf[i] as number) + sigma * z;
    }
  }
  const data = new Uint8ClampedArray(width * height);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.round(buf[i] as number);
  return { width, height, data };
}
