import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility — sign-in surface @a11y', () => {
  test('sign-in page has zero critical or serious axe violations', async ({ page }) => {
    await page.goto('/sign-in');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    const criticalOrSerious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(
      criticalOrSerious,
      `Axe violations:\n${JSON.stringify(criticalOrSerious, null, 2)}`,
    ).toHaveLength(0);
  });
});
