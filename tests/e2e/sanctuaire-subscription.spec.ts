/** E2E — historical purchase routes remain safe redirects. */
import { test, expect } from '@playwright/test';
import { mockFullSanctuaire } from '../helpers/api-mock';

test.describe('Sanctuaire — compatibilité des anciennes routes', () => {
  test.beforeEach(async ({ page }) => {
    await mockFullSanctuaire(page);
  });

  test('redirects the former subscription route to the profile without a loop', async ({
    page,
  }) => {
    await page.goto('/sanctuaire/abonnement');
    await page.waitForURL('**/sanctuaire/profile', { timeout: 10_000 });
    await expect(page.getByText('Accès early · 3 mois', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/abonnement|paiement récurrent|annuler/i)).toHaveCount(0);
  });

  test('redirects former billing settings to preferences', async ({ page }) => {
    await page.goto('/sanctuaire/settings/billing');
    await page.waitForURL('**/sanctuaire/settings/preferences', { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /réglages/i })).toBeVisible();
  });
});
