import { describe, it, expect } from 'vitest';
import * as DS from '../src/index.js';

describe('design-system barrel export', () => {
  it('exports token constants', () => {
    expect(DS.COLORS).toBeDefined();
    expect(DS.SPECTRUM).toBeDefined();
    expect(DS.FONTS).toBeDefined();
    expect(DS.SPACE).toBeDefined();
    expect(DS.RADIUS).toBeDefined();
    expect(DS.MOTION).toBeDefined();
    expect(DS.CARD_GRADIENT).toBeTypeOf('function');
  });

  it('exports React components as functions', () => {
    expect(DS.InfinityMark).toBeTypeOf('function');
    expect(DS.Button).toBeTypeOf('function');
    expect(DS.Card).toBeTypeOf('function');
    expect(DS.ModularCard).toBeTypeOf('function');
    expect(DS.Badge).toBeTypeOf('function');
    expect(DS.StatusPill).toBeTypeOf('function');
  });

  it('package name constant is correct', () => {
    expect(DS.PACKAGE_NAME).toBe('@infinite-ai/design-system');
  });
});
