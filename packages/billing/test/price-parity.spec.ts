import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { priceBreakdown, splitVat } from '../src/pricing.js';

// OQ-043 parity test: the price formula in src/pricing.ts is the source of truth.
// docs/COST_MODEL.md, docs/ONBOARDING_GUIDE.md and docs/financial-model.html must
// quote the same numbers. This test fails when any of them drifts.

const here = dirname(fileURLToPath(import.meta.url));
const docs = resolve(here, '../../../docs');
const read = (name: string): string => readFileSync(resolve(docs, name), 'utf8');

const REFERENCE = [
  { learners: 120, educators: 8 },
  { learners: 400, educators: 16 },
  { learners: 1_500, educators: 55 },
] as const;

// "R 1 380.00" (docs, with a space after R and a space thousands separator)
function money(cents: number): string {
  const rand = Math.floor(cents / 100);
  const rest = String(cents % 100).padStart(2, '0');
  const grouped = String(rand).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `R ${grouped}.${rest}`;
}

describe('price parity: code vs docs (OQ-043)', () => {
  for (const file of ['COST_MODEL.md', 'ONBOARDING_GUIDE.md']) {
    it(`${file} quotes ex VAT, VAT and inc VAT for every reference school`, () => {
      const text = read(file);
      for (const size of REFERENCE) {
        const ex = priceBreakdown(size).standardCents;
        const v = splitVat(ex);
        expect(text, `${file}: ex VAT for ${JSON.stringify(size)}`).toContain(
          money(v.exVatCents),
        );
        expect(text, `${file}: VAT for ${JSON.stringify(size)}`).toContain(
          money(v.vatCents),
        );
        expect(text, `${file}: inc VAT for ${JSON.stringify(size)}`).toContain(
          money(v.incVatCents),
        );
      }
    });

    it(`${file} no longer quotes the retired R1 200 / R3 500 / R8 500 card as a price`, () => {
      const text = read(file);
      expect(text).not.toMatch(/R 1 200 \/ month|R 3 500 \/ month|R 8 500 \/ month/);
    });
  }

  it('COST_MODEL.md states every formula constant', () => {
    const text = read('COST_MODEL.md');
    for (const phrase of [
      'R300 platform fee',
      'R75 per educator',
      'R4.00 per learner (first 500)',
      'R1.50 per learner above 500',
      'Minimum R750',
      '50 %',
      '10 % off',
    ]) {
      expect(text).toContain(phrase);
    }
  });

  it('financial-model.html offers the reference prices and defaults to the plan-mix blend', () => {
    const html = read('financial-model.html');
    const [small, pro] = REFERENCE.map((s) => priceBreakdown(s).standardCents / 100);
    const blend = Math.round(
      0.3 * (small ?? 0) +
        0.6 * (pro ?? 0) +
        0.1 * (priceBreakdown(REFERENCE[2]).standardCents / 100),
    );
    expect(html).toContain(`data-val="${String(small)}"`);
    expect(html).toContain(`data-val="${String(pro)}"`);
    expect(html).toContain(`class="pill active" data-val="${String(blend)}"`);
    expect(html).toContain(`price: ${String(blend)}`);
    expect(html).toContain(
      `const PRICES_SENS = [${String(small)}, 2000, ${String(blend)}, ${String(pro)}, 4000];`,
    );
    expect(html).not.toContain('data-val="4500"');
  });
});
