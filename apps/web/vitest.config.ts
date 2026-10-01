import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Match Next.js's automatic JSX runtime so a test can render a .tsx module (e.g. the root
  // layout) without `React` in scope.
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['tests/unit/**/*.spec.ts'],
    exclude: ['tests/e2e/**', 'tests/a11y/**'],
    environment: 'node',
  },
});
