import { expect, test } from '@playwright/test';
import { mockSanctuaireAuth } from '../helpers/api-mock';

const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z',
  'base64',
);

test.describe('Sanctuaire — photos privées', () => {
  test('renders only cookie-authenticated private streams, never storage or presigned URLs', async ({
    page,
  }) => {
    const auth = await mockSanctuaireAuth(page, {
      profileCompleted: true,
      orderStatus: 'PROCESSING',
    });
    const privateRequests: string[] = [];

    await page.route('**/api/bff/users/profile', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: auth.user.id,
          email: auth.user.email,
          firstName: auth.user.firstName,
          lastName: auth.user.lastName,
          profile: {
            id: auth.profile.id,
            profileCompleted: true,
            birthDate: '1990-06-15',
            birthPlace: 'Lyon, France',
            facePhotoUrl: 's3://onboarding/user-1/face.jpg',
            palmPhotoUrl: 's3://onboarding/user-1/palm.jpg',
          },
          stats: { totalOrders: 1, completedOrders: 1 },
        }),
      });
    });
    await page.route('**/api/bff/users/profile/photos/**', async (route) => {
      privateRequests.push(route.request().url());
      await route.fulfill({ status: 200, contentType: 'image/jpeg', body: TINY_JPEG });
    });

    await page.goto('/sanctuaire/dossier');
    await expect(page.getByText('Dossier scellé')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('img', { name: 'Photo de visage privée' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Photo de paume privée' })).toBeVisible();
    await expect(page.locator('img[src^="s3://"]')).toHaveCount(0);
    await expect(page.locator('img[src*="X-Amz-Signature"]')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('s3://');
    await expect(page.locator('body')).not.toContainText('X-Amz-Signature');

    expect(privateRequests).toHaveLength(2);
    expect(privateRequests.every((url) => url.includes('/users/profile/photos/'))).toBe(true);
    expect(privateRequests.some((url) => url.includes('user-2'))).toBe(false);
  });

  test('does not expose another client photo through the authenticated client surface', async ({
    page,
  }) => {
    await mockSanctuaireAuth(page, { profileCompleted: true });
    const photoRequests: string[] = [];
    await page.route('**/api/bff/users/profile/photos/**', async (route) => {
      photoRequests.push(route.request().url());
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/sanctuaire/profile');
    await expect(page.getByText('Aucune photo').first()).toBeVisible({ timeout: 20_000 });
    expect(
      photoRequests.every((url) => !url.includes('userId=') && !url.includes('clientId=')),
    ).toBe(true);
  });
});
