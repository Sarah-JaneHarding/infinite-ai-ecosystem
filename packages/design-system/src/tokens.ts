/** Design token constants — match values in tokens.css exactly. */

export const COLORS = {
  red: '#e4483f',
  redDeep: '#b11d15',
  orange: '#f2811f',
  orangeDeep: '#b45706',
  amber: '#f5b400',
  amberDeep: '#a77a00',
  green: '#2fae66',
  greenDeep: '#1e7845',
  teal: '#159e94',
  tealDeep: '#0c6e67',
  blue: '#1565c0',
  blueDeep: '#0d47a1',
  indigo: '#4a4fc4',
  indigoDeep: '#2b2f8d',
  violet: '#7b2fbe',
  violetDeep: '#5c1fa3',
} as const;

export const SPECTRUM = [
  COLORS.red,
  COLORS.orange,
  COLORS.amber,
  COLORS.green,
  COLORS.teal,
  COLORS.blue,
  COLORS.indigo,
  COLORS.violet,
] as const;

export const FONTS = {
  title: "'Playfair Display', Georgia, serif",
  body: "'DM Sans', system-ui, sans-serif",
  mono: "'Space Mono', 'Courier New', monospace",
} as const;

export const SPACE = [2, 3, 4, 5, 9, 11, 13, 15, 18, 22, 26, 32] as const;

export const RADIUS = [6, 9, 12, 16, 18, 24, 30] as const;

export const MOTION = {
  fast: 140,
  base: 200,
  slow: 250,
  progress: 800,
  drift: 9000,
} as const;

/** Gradient stop string for the 135° spectrum (Modular Card header). */
export const CARD_GRADIENT = (hue: keyof typeof COLORS) =>
  `linear-gradient(135deg, ${COLORS[hue]} 0%, ${COLORS[(hue + 'Deep') as keyof typeof COLORS] ?? COLORS[hue]} 100%)`;
