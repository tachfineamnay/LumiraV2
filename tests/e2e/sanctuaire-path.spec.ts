/** E2E — the historical Chemin URL points to the synthesis. */
import { test, expect } from '@playwright/test';
import { mockFullSanctuaire } from '../helpers/api-mock';

test('redirects the former Chemin route to the synthesis', async ({ page }) => {
  await mockFullSanctuaire(page);
  await page.goto('/sanctuaire/path');
  await page.waitForURL('**/sanctuaire/synthesis', { timeout: 10_000 });
  await expect(page.getByRole('heading', { name: 'Ma synthèse' })).toBeVisible();
});
