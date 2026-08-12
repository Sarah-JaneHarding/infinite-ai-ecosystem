import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.spec.ts'],
    exclude: ['tests/e2e/**', 'tests/a11y/**'],
    environment: 'node',
  },
});
