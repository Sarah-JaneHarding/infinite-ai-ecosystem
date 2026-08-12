import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    // Use the pre-installed Chromium in the CI sandbox.
    ...(process.env['PLAYWRIGHT_BROWSERS_PATH']
      ? { launchOptions: { executablePath: '/opt/pw-browsers/chromium' } }
      : {}),
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env['PLAYWRIGHT_BROWSERS_PATH']
          ? { launchOptions: { executablePath: '/opt/pw-browsers/chromium' } }
          : {}),
      },
    },
    {
      name: 'mobile-3g',
      use: {
        ...devices['Pixel 5'],
        ...(process.env['PLAYWRIGHT_BROWSERS_PATH']
          ? { launchOptions: { executablePath: '/opt/pw-browsers/chromium' } }
          : {}),
      },
    },
  ],

  // Start the Next.js dev server before running E2E tests.
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
