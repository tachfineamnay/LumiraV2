/** E2E — dream URLs from V1 remain usable bookmarks. */
import { test, expect } from '@playwright/test';
import { mockFullSanctuaire } from '../helpers/api-mock';

for (const legacyRoute of [
  '/sanctuaire/reves',
  '/sanctuaire/reves/nouveau',
  '/sanctuaire/reves/legacy-id',
]) {
  test(`redirects ${legacyRoute} to the synthesis`, async ({ page }) => {
    await mockFullSanctuaire(page);
    await page.goto(legacyRoute);
    await page.waitForURL('**/sanctuaire/synthesis', { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Ma synthèse' })).toBeVisible();
  });
}
