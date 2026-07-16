import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('should display brand and primary checkout CTA', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1').filter({ hasText: 'Oracle' })).toBeVisible();
    await expect(page.locator('h1').filter({ hasText: 'Lumira' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: /commencer mon voyage.*29€/i }).first(),
    ).toBeVisible();
  });

  test('should display the one-time lifetime offer without tier cards', async ({ page }) => {
    await page.goto('/');

    // Lifetime access has one offer; historical tier cards are not part of this funnel.
    await expect(page.getByTestId('level-p-init')).not.toBeVisible();
    await expect(page.getByTestId('level-p-itgr')).not.toBeVisible();
    await expect(
      page.getByRole('link', { name: /commencer mon voyage.*29€/i }).first(),
    ).toBeVisible();
  });

  test('CTA points to the checkout page', async ({ page }) => {
    await page.goto('/');
    const cta = page.getByRole('link', { name: /commencer mon voyage.*29€/i }).first();
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/commande');
  });
});
