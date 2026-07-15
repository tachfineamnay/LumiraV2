/** E2E Tests — one-time lifetime Sanctuaire access. */
import { test, expect } from '@playwright/test';
import { mockSanctuaireAuth } from '../helpers/api-mock';

test.describe('Sanctuaire access', () => {
  test.beforeEach(async ({ page }) => {
    await mockSanctuaireAuth(page, { subscribed: true });
  });

  test('shows active lifetime access and its activation date', async ({ page }) => {
    await page.goto('/sanctuaire/abonnement');

    await expect(page.getByText(/accès à vie/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/accès activé/i)).toBeVisible();
  });

  test('does not expose recurring cancellation controls for a lifetime purchase', async ({
    page,
  }) => {
    await page.goto('/sanctuaire/abonnement');

    await expect(
      page.locator('button:has-text("Annuler"), button:has-text("Reprendre")'),
    ).toHaveCount(0);
    await expect(page.getByText(/paiement unique/i)).toBeVisible();
  });
});

test.describe('Sanctuaire access — none active', () => {
  test('shows the one-time purchase call to action', async ({ page }) => {
    await mockSanctuaireAuth(page, { subscribed: false });
    await page.goto('/sanctuaire/abonnement');

    await expect(page.getByText(/aucun accès actif/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('link', { name: /accès à vie/i })).toBeVisible();
  });
});
