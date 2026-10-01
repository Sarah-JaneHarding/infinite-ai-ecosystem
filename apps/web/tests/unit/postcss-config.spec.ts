import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const webDir = fileURLToPath(new URL('../..', import.meta.url));
const at = (name: string): string => `${webDir}${name}`;

// `next build --webpack` does not load a TypeScript PostCSS config. With
// `postcss.config.ts` the build still succeeds, but Tailwind never runs: the emitted
// stylesheet keeps a raw `@theme` block and none of the utility classes, so every page
// renders as unstyled HTML (24,706 bytes instead of ~45 KB). `next dev` hid it.
describe('apps/web PostCSS config', () => {
  it('uses an extension Next.js loads, not .ts', () => {
    expect(existsSync(at('postcss.config.ts'))).toBe(false);
    const loadable = ['postcss.config.mjs', 'postcss.config.js', 'postcss.config.cjs'];
    expect(loadable.filter((name) => existsSync(at(name)))).toHaveLength(1);
  });

  it('registers the Tailwind PostCSS plugin', () => {
    const name = ['postcss.config.mjs', 'postcss.config.js', 'postcss.config.cjs'].find(
      (candidate) => existsSync(at(candidate)),
    );
    expect(name).toBeDefined();
    expect(readFileSync(at(name ?? ''), 'utf8')).toContain('@tailwindcss/postcss');
  });
});
