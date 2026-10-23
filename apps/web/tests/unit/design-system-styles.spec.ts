import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/postcss';
import postcss from 'postcss';
import { describe, it, expect } from 'vitest';

// Found by looking at the running app in a browser: every ModularCard showed an emoji and a
// status chip but no title. The card header is white text on a gradient, and the gradient
// classes (`from-[#159e94]`, `to-[#0c6e67]`, …) live in `packages/design-system`. Tailwind v4
// only scans the app it is run from, so those classes were never generated, the header had
// no background, and white-on-white made the title and eyebrow invisible. Unit tests could
// not see it: the markup was right, the stylesheet was not.
//
// This compiles the app's real stylesheet and asks whether the classes the design system's
// components use are in it.
const cssPath = fileURLToPath(new URL('../../src/app/globals.css', import.meta.url));

async function compile(): Promise<string> {
  const css = readFileSync(cssPath, 'utf8');
  const result = await postcss([tailwindcss()]).process(css, { from: cssPath });
  return result.css;
}

const cardSource = readFileSync(
  fileURLToPath(
    new URL(
      '../../../../packages/design-system/src/components/Card.tsx',
      import.meta.url,
    ),
  ),
  'utf8',
);

// Every `from-[#…]` / `to-[#…]` utility the card component names, read from the component
// itself so a new hue is covered without touching this test.
const gradientClasses = [...cardSource.matchAll(/\b((?:from|to)-\[#[0-9a-f]{6}\])/g)].map(
  (m) => m[1] ?? '',
);
// A utility's selector in the output escapes its brackets and hash: .from-\[\#159e94\]
const selector = (utility: string): string =>
  `.${utility.replace('[', '\\[').replace(']', '\\]').replace('#', '\\#')}`;

describe('the compiled stylesheet', () => {
  it('finds the card component gradients to check (guards the test itself)', () => {
    expect(gradientClasses.length).toBeGreaterThanOrEqual(16);
  });

  it("contains every gradient class the design system's card uses", async () => {
    const out = await compile();
    const missing = gradientClasses.filter((c) => !out.includes(selector(c)));
    expect(missing, `missing from the stylesheet: ${missing.join(', ')}`).toEqual([]);
    expect(out).toContain('.bg-gradient-to-br');
  });

  it("still contains the app's own classes", async () => {
    const out = await compile();
    expect(out).toContain('.min-h-dvh');
  });
}, 60_000);
