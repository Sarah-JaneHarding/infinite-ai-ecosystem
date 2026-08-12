import { describe, it, expect } from 'vitest';
import {
  COLORS,
  SPECTRUM,
  FONTS,
  SPACE,
  RADIUS,
  MOTION,
  CARD_GRADIENT,
} from '../src/tokens.js';

describe('COLORS', () => {
  it('defines all eight hues', () => {
    const hues = [
      'red',
      'orange',
      'amber',
      'green',
      'teal',
      'blue',
      'indigo',
      'violet',
    ] as const;
    for (const hue of hues) {
      expect(COLORS[hue]).toMatch(/^#[0-9a-f]{6}$/i);
      const deepKey = `${hue}Deep` as keyof typeof COLORS;
      expect(COLORS[deepKey]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('deep partner is darker than the base hue', () => {
    const pairs = [
      [COLORS.blue, COLORS.blueDeep],
      [COLORS.green, COLORS.greenDeep],
      [COLORS.violet, COLORS.violetDeep],
    ] as const;
    for (const [light, dark] of pairs) {
      const lightLum = parseInt(light.slice(1), 16);
      const darkLum = parseInt(dark.slice(1), 16);
      expect(lightLum).toBeGreaterThan(darkLum);
    }
  });

  it('exact brand values match the kit', () => {
    expect(COLORS.red).toBe('#e4483f');
    expect(COLORS.blue).toBe('#1565c0');
    expect(COLORS.violet).toBe('#7b2fbe');
  });
});

describe('SPECTRUM', () => {
  it('contains exactly eight hue values', () => {
    expect(SPECTRUM).toHaveLength(8);
  });
  it('starts with red and ends with violet', () => {
    expect(SPECTRUM[0]).toBe(COLORS.red);
    expect(SPECTRUM[7]).toBe(COLORS.violet);
  });
});

describe('FONTS', () => {
  it('references the three brand typefaces', () => {
    expect(FONTS.title).toContain('Playfair Display');
    expect(FONTS.body).toContain('DM Sans');
    expect(FONTS.mono).toContain('Space Mono');
  });
});

describe('SPACE', () => {
  it('has 12 rungs in the honest-pixel ladder', () => {
    expect(SPACE).toHaveLength(12);
  });
  it('is strictly ascending', () => {
    for (let i = 1; i < SPACE.length; i++) {
      expect(SPACE[i]).toBeGreaterThan(SPACE[i - 1] as number);
    }
  });
});

describe('RADIUS', () => {
  it('has 7 values', () => {
    expect(RADIUS).toHaveLength(7);
  });
  it('is strictly ascending', () => {
    for (let i = 1; i < RADIUS.length; i++) {
      expect(RADIUS[i]).toBeGreaterThan(RADIUS[i - 1] as number);
    }
  });
});

describe('MOTION', () => {
  it('fast < base < slow', () => {
    expect(MOTION.fast).toBeLessThan(MOTION.base);
    expect(MOTION.base).toBeLessThan(MOTION.slow);
  });
  it('drift matches brand spec (9000ms)', () => {
    expect(MOTION.drift).toBe(9000);
  });
});

describe('CARD_GRADIENT', () => {
  it('returns a linear-gradient string', () => {
    const result = CARD_GRADIENT('blue');
    expect(result).toMatch(/^linear-gradient/);
    expect(result).toContain(COLORS.blue);
  });

  it('handles a hue with no Deep partner gracefully', () => {
    const result = CARD_GRADIENT('red');
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });
});
