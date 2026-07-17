/** E2E — profile is reachable from the avatar and represents permanent access. */
import { test, expect } from '@playwright/test';
import { mockSanctuaireAuth } from '../helpers/api-mock';

test.describe('Sanctuaire — profil', () => {
  test('shows client identity and the lifetime-access badge', async ({ page }) => {
    await mockSanctuaireAuth(page, { profileCompleted: true });
    await page.goto('/sanctuaire/profile');

    await expect(page.getByRole('heading', { name: /marie dubois/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Accès à vie', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/abonné|premium|abonnement/i)).toHaveCount(0);
  });

  test('keeps uploaded client photos private in the interface', async ({ page }) => {
    await mockSanctuaireAuth(page, {
      profileCompleted: true,
      user: { firstName: 'Marie', lastName: 'Dubois' },
    });
    await page.route('**/api/bff/users/profile', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-1',
          email: 'marie@example.test',
          firstName: 'Marie',
          lastName: 'Dubois',
          profile: {
            facePhotoUrl: 's3://onboarding/user-1/face.jpg',
            palmPhotoUrl: 's3://onboarding/user-1/palm.jpg',
            profileCompleted: true,
          },
          stats: { totalOrders: 1, completedOrders: 1 },
        }),
      });
    });

    await page.goto('/sanctuaire/profile');

    await expect(page.getByText('Photo enregistrée de façon privée')).toHaveCount(2, {
      timeout: 20_000,
    });
    await expect(page.locator('img[src^="s3://"]')).toHaveCount(0);
  });
});
