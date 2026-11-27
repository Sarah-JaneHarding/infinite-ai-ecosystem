// Camera-frame detector: finds every card in a grayscale frame and reads its number and side.
//
// Safety property: a reading is correct or absent. A wrong card number or side marks a child
// wrong, so every stage below drops a candidate it is unsure of; the teacher simply re-scans.
//
// Pipeline: global Otsu threshold; 4-connected dark components (explicit queue, no recursion);
// convex hull of each component; the largest-area quadrilateral inscribed in the hull; corners
// ordered clockwise from the left end of the topmost edge, so the side reported is the side at
// the top as the camera sees it; a homography onto the 7x7 grid; per-card threshold; border check;
// decodeGrid. Pure TypeScript with typed arrays and no per-pixel allocation, so it can run in a
// browser worker on a phone.

import type { CardSide } from '../cards.js';
import { decodeGrid } from './decode.js';
import { CARD_CELLS, GRID } from './grid.js';

/** A grayscale image, row-major, 0 = black. */
export interface GrayFrame {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export interface MarkerReading {
  cardNumber: number;
  /** The side at the top of the card as the camera sees it. */
  side: CardSide;
  /** Cells that differed from the matched pattern (0 to 2). */
  distance: number;
  confidence: 'high' | 'low';
  /** Image point of the card's centre (the homography image of the grid centre). */
  centre: { x: number; y: number };
  /** Mean length of the four edges of the 7-cell square, in pixels. */
  sidePx: number;
  /** Angle of the topmost edge from horizontal, in degrees (0 to 45). */
  tiltDeg: number;
}

/** Frames whose darkest and brightest pixels differ by less than this hold no readable card. */
const MIN_FRAME_CONTRAST = 30;
/** 3 px per cell: smaller squares give no reading. */
const MIN_SIDE_PX = 3 * CARD_CELLS;
/** 5 px per cell: the smallest square read with high confidence. */
const HIGH_MIN_SIDE_PX = 5 * CARD_CELLS;
const HIGH_MAX_TILT_DEG = 30;
const HIGH_MAX_DISTANCE = 1;
/** Components covering this share of the frame are background, not a card. */
const MAX_FRAME_SHARE = 0.95;
const MAX_HULL_VERTICES = 64;
/** Of the 24 border cells, at least this many must sample dark. */
const MIN_DARK_BORDER = 22;
const BORDER_CELLS = 4 * (CARD_CELLS - 1);

function assertFrame(frame: GrayFrame): void {
  const { width, height, data } = frame;
  if (!Number.isInteger(width) || width < 1) {
    throw new RangeError('width must be a positive integer');
  }
  if (!Number.isInteger(height) || height < 1) {
    throw new RangeError('height must be a positive integer');
  }
  if (data.length !== width * height) {
    throw new RangeError('data length must equal width * height');
  }
}

/** Otsu's threshold: pixels at or below it are dark. Ties resolve to the middle of the plateau. */
function otsu(hist: Uint32Array, total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i += 1) sum += i * (hist[i] as number);
  let sumB = 0;
  let weightB = 0;
  let best = -1;
  let first = 0;
  let last = 0;
  for (let i = 0; i < 256; i += 1) {
    const count = hist[i] as number;
    weightB += count;
    if (weightB === 0) continue;
    const weightF = total - weightB;
    if (weightF === 0) break;
    sumB += i * count;
    const diff = sumB / weightB - (sum - sumB) / weightF;
    const between = weightB * weightF * diff * diff;
    if (between > best) {
      best = between;
      first = i;
      last = i;
    } else if (between === best) {
      last = i;
    }
  }
  return Math.floor((first + last) / 2);
}

/** Working buffers for one frame, allocated once per call. */
interface Scratch {
  readonly rowMin: Int32Array;
  readonly rowMax: Int32Array;
  readonly px: Float64Array;
  readonly py: Float64Array;
  readonly hx: Float64Array;
  readonly hy: Float64Array;
  readonly cx: Float64Array;
  readonly cy: Float64Array;
  readonly samples: Float64Array;
}

/** Twice the absolute area of triangle (a, b, c) of the capped hull. */
function tri(s: Scratch, a: number, b: number, c: number): number {
  const ax = s.cx[a] as number;
  const ay = s.cy[a] as number;
  return Math.abs(
    ((s.cx[b] as number) - ax) * ((s.cy[c] as number) - ay) -
      ((s.cy[b] as number) - ay) * ((s.cx[c] as number) - ax),
  );
}

/**
 * Read one component whose pixels are queue[0, count) and whose rows are minY..maxY. Returns null
 * when any check fails.
 */
function readComponent(
  frame: GrayFrame,
  queue: Int32Array,
  count: number,
  minY: number,
  maxY: number,
  s: Scratch,
): MarkerReading | null {
  const { width, height, data } = frame;

  // Leftmost and rightmost pixel of each row: the hull of the component is the hull of the corners
  // of these pixels (a connected component has a pixel in every row between minY and maxY).
  for (let y = minY; y <= maxY; y += 1) {
    s.rowMin[y] = width;
    s.rowMax[y] = -1;
  }
  for (let q = 0; q < count; q += 1) {
    const p = queue[q] as number;
    const x = p % width;
    const y = (p - x) / width;
    if (x < (s.rowMin[y] as number)) s.rowMin[y] = x;
    if (x > (s.rowMax[y] as number)) s.rowMax[y] = x;
  }

  // Pixel-corner points, sorted by (y, x): at each horizontal grid line, the extreme corners of
  // the rows above and below it.
  let m = 0;
  for (let y = minY; y <= maxY + 1; y += 1) {
    let lo = width;
    let hi = -1;
    if (y > minY) {
      lo = Math.min(lo, s.rowMin[y - 1] as number);
      hi = Math.max(hi, s.rowMax[y - 1] as number);
    }
    if (y <= maxY) {
      lo = Math.min(lo, s.rowMin[y] as number);
      hi = Math.max(hi, s.rowMax[y] as number);
    }
    s.px[m] = lo;
    s.py[m] = y;
    m += 1;
    s.px[m] = hi + 1;
    s.py[m] = y;
    m += 1;
  }

  // Andrew's monotone chain over the (y, x)-sorted points.
  let k = 0;
  const cross = (o: number, a: number, bx: number, by: number): number => {
    const ox = s.hx[o] as number;
    const oy = s.hy[o] as number;
    return (
      ((s.hx[a] as number) - ox) * (by - oy) - ((s.hy[a] as number) - oy) * (bx - ox)
    );
  };
  for (let i = 0; i < m; i += 1) {
    const bx = s.px[i] as number;
    const by = s.py[i] as number;
    while (k >= 2 && cross(k - 2, k - 1, bx, by) <= 0) k -= 1;
    s.hx[k] = bx;
    s.hy[k] = by;
    k += 1;
  }
  const lowerSize = k + 1;
  for (let i = m - 2; i >= 0; i -= 1) {
    const bx = s.px[i] as number;
    const by = s.py[i] as number;
    while (k >= lowerSize && cross(k - 2, k - 1, bx, by) <= 0) k -= 1;
    s.hx[k] = bx;
    s.hy[k] = by;
    k += 1;
  }
  k -= 1; // The last point repeats the first.
  if (k < 4) return null;

  // Cap the hull by even subsampling so the quad search stays O(h^2) with h <= 64.
  const h = Math.min(k, MAX_HULL_VERTICES);
  for (let i = 0; i < h; i += 1) {
    const src = Math.floor((i * k) / h);
    s.cx[i] = s.hx[src] as number;
    s.cy[i] = s.hy[src] as number;
  }

  // Largest-area inscribed quadrilateral (i, a, j, b): for each diagonal (i, j) the best vertex
  // on each side maximises a unimodal triangle area, and both optima advance monotonically with j.
  let bestArea = -1;
  let q0 = 0;
  let q1 = 0;
  let q2 = 0;
  let q3 = 0;
  for (let i = 0; i < h; i += 1) {
    let a = i + 1;
    let b = i + 3;
    for (let j = i + 2; j <= i + h - 2; j += 1) {
      if (b <= j) b = j + 1;
      while (a + 1 < j && tri(s, i, (a + 1) % h, j % h) >= tri(s, i, a % h, j % h))
        a += 1;
      while (b + 1 < i + h && tri(s, j % h, (b + 1) % h, i) >= tri(s, j % h, b % h, i))
        b += 1;
      const area = tri(s, i, a % h, j % h) + tri(s, j % h, b % h, i);
      if (area > bestArea) {
        bestArea = area;
        q0 = i;
        q1 = a % h;
        q2 = j % h;
        q3 = b % h;
      }
    }
  }
  const qx = [
    s.cx[q0] as number,
    s.cx[q1] as number,
    s.cx[q2] as number,
    s.cx[q3] as number,
  ];
  const qy = [
    s.cy[q0] as number,
    s.cy[q1] as number,
    s.cy[q2] as number,
    s.cy[q3] as number,
  ];

  // The monotone chain over (y, x)-sorted points emits the hull clockwise as seen in the image
  // (y down), whatever the component's shape, and q0, q1, q2, q3 follow the hull in cyclic order,
  // so the corners already run clockwise; no orientation check is needed.

  // Start at the left end of the topmost edge (smallest midpoint y). Going clockwise, the top edge
  // runs left to right, so its left end is the edge's first corner.
  let top = 0;
  let topMid = Infinity;
  for (let e = 0; e < 4; e += 1) {
    const mid = (qy[e] as number) + (qy[(e + 1) & 3] as number);
    if (mid < topMid) {
      topMid = mid;
      top = e;
    }
  }
  const x0 = qx[top] as number;
  const y0 = qy[top] as number;
  const x1 = qx[(top + 1) & 3] as number;
  const y1 = qy[(top + 1) & 3] as number;
  const x2 = qx[(top + 2) & 3] as number;
  const y2 = qy[(top + 2) & 3] as number;
  const x3 = qx[(top + 3) & 3] as number;
  const y3 = qy[(top + 3) & 3] as number;

  const sidePx =
    (Math.hypot(x1 - x0, y1 - y0) +
      Math.hypot(x2 - x1, y2 - y1) +
      Math.hypot(x3 - x2, y3 - y2) +
      Math.hypot(x0 - x3, y0 - y3)) /
    4;
  if (sidePx < MIN_SIDE_PX) return null;
  const tiltDeg = Math.abs((Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI);

  // Homography of the unit square (0,0),(1,0),(1,1),(0,1) onto the ordered corners (Heckbert).
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const den = dx1 * dy2 - dx2 * dy1;
  if (den === 0) return null;
  const g = (sx * dy2 - dx2 * sy) / den;
  const hh = (dx1 * sy - sx * dy1) / den;
  const ha = x1 - x0 + g * x1;
  const hb = x3 - x0 + hh * x3;
  const hd = y1 - y0 + g * y1;
  const he = y3 - y0 + hh * y3;

  // Sample each cell centre as the mean of the 3 x 3 pixels around it.
  for (let r = 0; r < CARD_CELLS; r += 1) {
    for (let c = 0; c < CARD_CELLS; c += 1) {
      const u = (c + 0.5) / CARD_CELLS;
      const v = (r + 0.5) / CARD_CELLS;
      const w = g * u + hh * v + 1;
      const cxp = Math.floor((ha * u + hb * v + x0) / w);
      const cyp = Math.floor((hd * u + he * v + y0) / w);
      let sum = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        const yy = Math.min(height - 1, Math.max(0, cyp + dy));
        for (let dx = -1; dx <= 1; dx += 1) {
          const xx = Math.min(width - 1, Math.max(0, cxp + dx));
          sum += data[yy * width + xx] as number;
        }
      }
      s.samples[r * CARD_CELLS + c] = sum / 9;
    }
  }

  // Per-card threshold: midway between the border's mean and the brightest data cell.
  let borderSum = 0;
  let brightest = 0;
  for (let r = 0; r < CARD_CELLS; r += 1) {
    for (let c = 0; c < CARD_CELLS; c += 1) {
      const value = s.samples[r * CARD_CELLS + c] as number;
      if (r === 0 || c === 0 || r === CARD_CELLS - 1 || c === CARD_CELLS - 1)
        borderSum += value;
      else if (value > brightest) brightest = value;
    }
  }
  const threshold = (borderSum / BORDER_CELLS + brightest) / 2;

  let darkBorder = 0;
  let bits = 0;
  for (let r = 0; r < CARD_CELLS; r += 1) {
    for (let c = 0; c < CARD_CELLS; c += 1) {
      const dark = (s.samples[r * CARD_CELLS + c] as number) < threshold;
      if (r === 0 || c === 0 || r === CARD_CELLS - 1 || c === CARD_CELLS - 1) {
        if (dark) darkBorder += 1;
      } else if (dark) {
        bits |= 1 << ((r - 1) * GRID + (c - 1));
      }
    }
  }
  if (darkBorder < MIN_DARK_BORDER) return null;

  const match = decodeGrid(bits >>> 0);
  if (match === null) return null;

  const wc = g * 0.5 + hh * 0.5 + 1;
  const high =
    match.distance <= HIGH_MAX_DISTANCE &&
    tiltDeg <= HIGH_MAX_TILT_DEG &&
    sidePx >= HIGH_MIN_SIDE_PX;
  return {
    cardNumber: match.cardNumber,
    side: match.side,
    distance: match.distance,
    confidence: high ? 'high' : 'low',
    centre: { x: (ha * 0.5 + hb * 0.5 + x0) / wc, y: (hd * 0.5 + he * 0.5 + y0) / wc },
    sidePx,
    tiltDeg,
  };
}

/**
 * Find and read every card in a frame. Readings are sorted by centre.y, then centre.x. Two cards
 * with the same number both appear; de-duplication belongs to the tally.
 */
export function detectCards(frame: GrayFrame): readonly MarkerReading[] {
  assertFrame(frame);
  const { width, height, data } = frame;
  const total = width * height;

  const hist = new Uint32Array(256);
  for (let i = 0; i < total; i += 1) {
    const v = data[i] as number;
    hist[v] = (hist[v] as number) + 1;
  }
  let lo = 0;
  while (hist[lo] === 0) lo += 1;
  let hi = 255;
  while (hist[hi] === 0) hi -= 1;
  if (hi - lo < MIN_FRAME_CONTRAST) return [];
  const threshold = otsu(hist, total);

  // 1 = dark and unvisited, 2 = dark and visited, 0 = light.
  const state = new Uint8Array(total);
  for (let i = 0; i < total; i += 1) state[i] = (data[i] as number) <= threshold ? 1 : 0;

  const queue = new Int32Array(total);
  const points = 2 * (height + 1);
  const scratch: Scratch = {
    rowMin: new Int32Array(height),
    rowMax: new Int32Array(height),
    px: new Float64Array(points),
    py: new Float64Array(points),
    hx: new Float64Array(points + 1),
    hy: new Float64Array(points + 1),
    cx: new Float64Array(MAX_HULL_VERTICES),
    cy: new Float64Array(MAX_HULL_VERTICES),
    samples: new Float64Array(CARD_CELLS * CARD_CELLS),
  };
  const readings: MarkerReading[] = [];

  for (let start = 0; start < total; start += 1) {
    if (state[start] !== 1) continue;
    state[start] = 2;
    queue[0] = start;
    let head = 0;
    let tail = 1;
    let minX = width;
    let maxX = -1;
    let minY = height;
    let maxY = -1;
    while (head < tail) {
      const p = queue[head] as number;
      head += 1;
      const x = p % width;
      const y = (p - x) / width;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x > 0 && state[p - 1] === 1) {
        state[p - 1] = 2;
        queue[tail] = p - 1;
        tail += 1;
      }
      if (x < width - 1 && state[p + 1] === 1) {
        state[p + 1] = 2;
        queue[tail] = p + 1;
        tail += 1;
      }
      if (y > 0 && state[p - width] === 1) {
        state[p - width] = 2;
        queue[tail] = p - width;
        tail += 1;
      }
      if (y < height - 1 && state[p + width] === 1) {
        state[p + width] = 2;
        queue[tail] = p + width;
        tail += 1;
      }
    }

    // A card cut by the frame edge cannot be read whole; skip it rather than guess.
    if (minX === 0 || minY === 0 || maxX === width - 1 || maxY === height - 1) continue;
    // The bounding box is at least as large as the square's side, so this is a safe early reject.
    if (Math.max(maxX - minX + 1, maxY - minY + 1) < MIN_SIDE_PX) continue;
    if (tail >= MAX_FRAME_SHARE * total) continue;

    const reading = readComponent(frame, queue, tail, minY, maxY, scratch);
    if (reading !== null) readings.push(reading);
  }

  return readings.sort((a, b) => a.centre.y - b.centre.y || a.centre.x - b.centre.x);
}
