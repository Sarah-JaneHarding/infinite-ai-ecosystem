import { test, expect } from '@playwright/test';

// These tests require the Next.js dev server (started via webServer in playwright.config.ts).
// In CI, a mock auth session is injected via storage state or a test-auth endpoint.

test.describe('Teacher Studio', () => {
  test.beforeEach(async ({ page }) => {
    // The sign-in page should be reachable without auth.
    await page.goto('/sign-in');
    await expect(page).toHaveTitle(/INFINITE-AI/);
  });

  test('sign-in page has the brand mark and tagline @a11y', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.getByRole('img', { name: /Infinite AI/i })).toBeVisible();
    await expect(page.getByText('Educate · Innovate · Transform')).toBeVisible();
  });

  test('sign-in page has a Keycloak sign-in button @a11y', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(
      page.getByRole('button', { name: /sign in with keycloak/i }),
    ).toBeVisible();
  });

  test('unauthenticated visit to /teacher redirects to /sign-in', async ({ page }) => {
    await page.goto('/teacher');
    await expect(page).toHaveURL(/sign-in/);
  });

  test('unauthenticated visit to /hod redirects to /sign-in', async ({ page }) => {
    await page.goto('/hod');
    await expect(page).toHaveURL(/sign-in/);
  });

  test('unauthenticated visit to /learner redirects to /sign-in', async ({ page }) => {
    await page.goto('/learner');
    await expect(page).toHaveURL(/sign-in/);
  });
});
