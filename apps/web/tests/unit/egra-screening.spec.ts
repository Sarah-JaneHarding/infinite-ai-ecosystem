import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

import {
  SUBTESTS,
  evaluateAll,
  evaluateSubtest,
  parseNonNegative,
} from '../../src/components/sbst/egra-screening.js';
import { EgraScreeningView } from '../../src/components/sbst/EgraScreeningView.js';

// R01 / T02 / OQ-035: the screening tab must never turn missing, partial or invalid input
// into reassurance, must ship no benchmark, and must recommend no tier.

const lsi = SUBTESTS.find((s) => s.id === 'LSI')!;
const pa = SUBTESTS.find((s) => s.id === 'PA')!;

describe('EGRA screening comparison', () => {
  it('reports below / meets against the benchmark the school typed', () => {
    expect(evaluateSubtest(lsi, '40', '54').status).toBe('below');
    expect(evaluateSubtest(lsi, '54', '54').status).toBe('meets');
    expect(evaluateSubtest(lsi, '60.5', '54').status).toBe('meets');
  });

  it('gives no result for blank input — never "on track" (the audited defect)', () => {
    const all = evaluateAll({}, {});
    expect(all).toHaveLength(SUBTESTS.length);
    expect(all.every((r) => r.status === 'not-entered')).toBe(true);
    expect(evaluateSubtest(lsi, '   ', '54').status).toBe('not-entered');
    expect(evaluateSubtest(lsi, undefined, '54').status).toBe('not-entered');
  });

  it('gives no result for a score with no benchmark, rather than assuming one', () => {
    expect(evaluateSubtest(lsi, '10', undefined).status).toBe('no-benchmark');
    expect(evaluateSubtest(lsi, '10', '').status).toBe('no-benchmark');
  });

  it('rejects invalid scores and benchmarks', () => {
    for (const bad of ['abc', '-1', '1e3', 'NaN', 'Infinity', '0x10', '1,5', '5.']) {
      expect(evaluateSubtest(lsi, bad, '54').status).toBe('invalid-score');
      expect(evaluateSubtest(lsi, '10', bad).status).toBe('invalid-benchmark');
      expect(parseNonNegative(bad)).toBeNull();
    }
  });

  it('refuses a percentage above 100 but not a rate above 100', () => {
    expect(evaluateSubtest(pa, '101', '60').status).toBe('invalid-score');
    expect(evaluateSubtest(pa, '50', '101').status).toBe('invalid-benchmark');
    expect(evaluateSubtest(lsi, '101', '54').status).toBe('meets');
  });

  it('treats a typed zero as a score, not as blank', () => {
    expect(evaluateSubtest(lsi, '0', '54').status).toBe('below');
  });
});

describe('EGRA screening ships no policy', () => {
  const here = (p: string): string =>
    readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');

  it('carries no benchmark table, tier rule or tier label in source', () => {
    for (const file of [
      '../../src/components/sbst/egra-screening.ts',
      '../../src/components/sbst/EgraScreeningView.tsx',
    ]) {
      const src = here(file);
      expect(src).not.toMatch(/benchmarks\s*:\s*\{/);
      expect(src).not.toMatch(/tierFromFlags/);
      expect(src).not.toMatch(/Tier\s*[123]\s*[—-]/);
      expect(src).not.toMatch(/On track/i);
    }
  });

  it('renders no tier and no pre-filled benchmark', () => {
    const html = renderToStaticMarkup(createElement(EgraScreeningView));
    expect(html).not.toMatch(/Tier\s*[123]/);
    expect(html).not.toMatch(/On track/i);
    expect(html).not.toMatch(/recommended/i);
    expect(html).toContain('does not recommend a support tier');
    // every benchmark input starts empty
    const benchmarkInputs = html.match(/<input[^>]*id="benchmark-[^>]*>/g) ?? [];
    expect(benchmarkInputs).toHaveLength(SUBTESTS.length);
    for (const tag of benchmarkInputs) expect(tag).toMatch(/value=""/);
  });
});
