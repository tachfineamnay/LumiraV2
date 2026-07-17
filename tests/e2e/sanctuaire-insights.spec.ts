/** E2E — the synthesis is constrained to server-generated reading data. */
import { test, expect } from '@playwright/test';
import { mockFullSanctuaire } from '../helpers/api-mock';

const BFF = '**/api/bff';

test.describe('Sanctuaire — ma synthèse', () => {
  test('redirects the former insights route to the canonical synthesis', async ({ page }) => {
    await mockFullSanctuaire(page);
    await page.goto('/sanctuaire/insights');
    await page.waitForURL('**/sanctuaire/synthesis', { timeout: 10_000 });
  });

  test('shows no more than the four generated sections', async ({ page }) => {
    await mockFullSanctuaire(page);
    await page.route(`${BFF}/client/spiritual-path`, async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          exists: true,
          archetype: 'Le Sage',
          lifeMission: 'Prendre soin de votre rythme.',
          keyBlockage: 'Ne pas vous oublier.',
          keywords: ['ancrage', 'clarté'],
          synthesis: 'Avancez par étapes simples.',
        }),
      });
    });

    await page.goto('/sanctuaire/synthesis');

    for (const title of [
      'Forces',
      'Points d’attention',
      'Thèmes récurrents',
      'Conseils essentiels',
    ]) {
      await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 20_000 });
    }
    await expect(page.locator('main section h2')).toHaveCount(4);
  });

  test('keeps the specified empty state when no validated synthesis exists', async ({ page }) => {
    await mockFullSanctuaire(page);
    await page.route(`${BFF}/client/spiritual-path`, async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ exists: false }),
      });
    });

    await page.goto('/sanctuaire/synthesis');

    await expect(
      page.getByRole('heading', { name: 'Votre synthèse se construit avec vos lectures.' }),
    ).toBeVisible({ timeout: 20_000 });
  });
});
