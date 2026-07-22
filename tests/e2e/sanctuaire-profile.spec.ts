/** E2E — profile is reachable from the avatar and represents permanent access. */
import { test, expect } from '@playwright/test';
import { mockSanctuaireAuth } from '../helpers/api-mock';

const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z',
  'base64',
);

test.describe('Sanctuaire — profil', () => {
  test('shows client identity and the lifetime-access badge', async ({ page }) => {
    await mockSanctuaireAuth(page, { profileCompleted: true });
    await page.goto('/sanctuaire/profile');

    await expect(page.getByRole('heading', { name: /marie dubois/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Accès early · 3 mois', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/abonné|premium|abonnement/i)).toHaveCount(0);
  });

  test('streams private face and palm photos without exposing s3:// sources', async ({ page }) => {
    await mockSanctuaireAuth(page, {
      profileCompleted: true,
      user: { firstName: 'Marie', lastName: 'Dubois' },
    });

    await page.route('**/api/bff/users/profile', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
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

    await page.route('**/api/bff/users/profile/photos/face**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/jpeg',
        body: TINY_JPEG,
      });
    });
    await page.route('**/api/bff/users/profile/photos/palm**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/jpeg',
        body: TINY_JPEG,
      });
    });

    await page.goto('/sanctuaire/profile');

    await expect(page.getByRole('img', { name: /photo de visage/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('img', { name: /photo de paume/i })).toBeVisible();
    await expect(page.locator('img[src^="s3://"]')).toHaveCount(0);
    await expect(page.locator('img[src*="/api/bff/users/profile/photos/face"]')).toHaveCount(1);
    await expect(page.locator('img[src*="/api/bff/users/profile/photos/palm"]')).toHaveCount(1);

    await page.getByRole('button', { name: /photo de visage/i }).click();
    await expect(page.getByRole('dialog', { name: /photo de visage/i })).toBeVisible();
    await page.getByRole('button', { name: 'Fermer' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('shows an empty state when a private photo is missing', async ({ page }) => {
    await mockSanctuaireAuth(page, { profileCompleted: true });
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
            palmPhotoUrl: null,
            profileCompleted: true,
          },
          stats: { totalOrders: 1, completedOrders: 1 },
        }),
      });
    });
    await page.route('**/api/bff/users/profile/photos/face**', async (route) => {
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/sanctuaire/profile');
    await expect(page.getByText('Aucune photo').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('img[src^="s3://"]')).toHaveCount(0);
  });
});
