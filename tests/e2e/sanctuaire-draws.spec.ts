/** E2E — delivered readings use private API paths and real order statuses. */
import { test, expect } from '@playwright/test';
import { mockDrawsApi, mockSanctuaireAuth } from '../helpers/api-mock';

test.describe('Sanctuaire — mes lectures', () => {
  test('lists validated and pending readings without future offers', async ({ page }) => {
    await mockSanctuaireAuth(page, { profileCompleted: true });
    await mockDrawsApi(page);

    await page.goto('/sanctuaire/draws');

    await expect(page.getByRole('heading', { name: 'Mes lectures' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Lecture d'Âme").first()).toBeVisible();
    await expect(page.getByText('Prête', { exact: true })).toBeVisible();
    await expect(page.getByText('En préparation')).toBeVisible();
    await expect(
      page.getByText(/mes révélations|nouvelle lecture|bientôt|voir les offres/i),
    ).toHaveCount(0);
  });

  test('exposes the real reading actions, including audio when provided', async ({ page }) => {
    await mockSanctuaireAuth(page, { profileCompleted: true });
    await page.route('**/api/bff/client/readings', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          readings: [
            {
              id: 'order-1',
              orderNumber: 'LU240115001',
              status: 'COMPLETED',
              deliveredAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              title: "Lecture d'Âme",
              archetype: 'Le Sage',
              intention: 'Une lecture validée.',
              assets: {
                pdf: '/api/readings/LU240115001/file',
                audio: '/api/readings/LU240115001/audio',
              },
            },
          ],
          pending: [],
        }),
      });
    });

    await page.goto('/sanctuaire/draws');

    await expect(page.getByRole('button', { name: 'Lire', exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: 'Télécharger le PDF' })).toBeVisible();
    await expect(page.getByRole('button', { name: /lire l.audio/i })).toBeVisible();
  });

  test('uses the empty state when no server reading exists', async ({ page }) => {
    await mockSanctuaireAuth(page, { profileCompleted: true, hasOrders: false });
    await page.route('**/api/bff/client/readings', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ readings: [], pending: [] }),
      });
    });

    await page.goto('/sanctuaire/draws');

    await expect(page.getByRole('heading', { name: 'Vos lectures apparaîtront ici' })).toBeVisible({
      timeout: 20_000,
    });
  });
});
