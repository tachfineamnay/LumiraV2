import { expect, test } from '@playwright/test';
import { mockSanctuaireAuth } from '../helpers/api-mock';

const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z',
  'base64',
);

test.describe('Sanctuaire — scellement explicite du dossier', () => {
  test('seals exactly one reviewed intake, then refuses both a second seal and edits during production', async ({
    page,
  }) => {
    const auth = await mockSanctuaireAuth(page, { profileCompleted: false, orderStatus: 'PAID' });
    let sealed = false;
    let sealedPayload: Record<string, unknown> | null = null;
    let secondSealAttempts = 0;

    const sealedProfile = {
      id: auth.profile.id,
      birthDate: '1990-06-15',
      birthTime: '09:45',
      birthPlace: 'Lyon, France',
      specificQuestion: 'Que dois-je comprendre après ma relecture ?',
      objective: 'Avancer sereinement',
      highs: 'Ma créativité',
      lows: null,
      ailments: null,
      fears: null,
      rituals: null,
      facePhotoUrl: 's3://onboarding/user-1/face.jpg',
      palmPhotoUrl: 's3://onboarding/user-1/palm.jpg',
      profileCompleted: true,
    };

    await page.route('**/api/bff/users/profile', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            id: auth.user.id,
            email: auth.user.email,
            firstName: auth.user.firstName,
            lastName: auth.user.lastName,
            profile: sealed ? sealedProfile : { id: auth.profile.id, profileCompleted: false },
            stats: { totalOrders: 1, completedOrders: 1 },
          }),
        });
        return;
      }

      if (sealed) {
        secondSealAttempts += 1;
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Ce dossier est déjà scellé.' }),
        });
        return;
      }

      sealedPayload = route.request().postDataJSON() as Record<string, unknown>;
      sealed = true;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ profile: sealedProfile }),
      });
    });

    await page.route('**/api/bff/users/orders/completed', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ ...auth.order, status: sealed ? 'PROCESSING' : 'PAID' }]),
      });
    });

    await page.route('**/api/bff/users/profile/photos/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/jpeg', body: TINY_JPEG });
    });

    await page.route('**/api/bff/uploads/onboarding-presign', async (route) => {
      const { kind } = route.request().postDataJSON() as { kind: 'FACE' | 'PALM' };
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          uploadUrl: `https://upload.example.test/${kind.toLowerCase()}`,
          storageRef: `s3://onboarding/user-1/${kind.toLowerCase()}.jpg`,
        }),
      });
    });
    await page.route('https://upload.example.test/**', async (route) => {
      await route.fulfill({ status: 200, body: '' });
    });

    await page.goto('/sanctuaire');
    await page.getByRole('button', { name: 'Préparer mon dossier' }).click();
    await page.getByRole('button', { name: 'Commencer mon dossier' }).click();
    await page.getByLabel('Date de naissance').fill('1990-06-15');
    await page.getByLabel('Heure (facultative)').fill('09:45');
    await page.getByLabel('Lieu de naissance').fill('Lyon, France');
    await page.getByRole('button', { name: 'Continuer' }).click();

    await page.getByLabel(/Votre question/).fill('Question provisoire');
    await page.getByLabel(/Ce que vous souhaitez comprendre/).fill('Avancer sereinement');
    await page.getByRole('button', { name: 'Continuer' }).click();

    await page.getByLabel('Sélectionner une photo').first().setInputFiles({
      name: 'visage.jpg',
      mimeType: 'image/jpeg',
      buffer: TINY_JPEG,
    });
    await expect(page.getByRole('img', { name: 'Visage' })).toBeVisible();
    await page.getByLabel('Sélectionner une photo').first().setInputFiles({
      name: 'paume.jpg',
      mimeType: 'image/jpeg',
      buffer: TINY_JPEG,
    });
    await expect(page.getByRole('img', { name: 'Paume' })).toBeVisible();
    await page.getByRole('button', { name: 'Continuer' }).click();

    await page.getByLabel(/Ce qui vous porte/).fill('Ma créativité');
    await page.getByRole('button', { name: 'Continuer' }).click();

    await expect(page.getByRole('heading', { name: 'Relire et sceller' })).toBeVisible();
    await page.getByRole('button', { name: 'Modifier' }).nth(1).click();
    await page.getByLabel(/Votre question/).fill('Que dois-je comprendre après ma relecture ?');
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.getByRole('button', { name: 'Continuer' }).click();

    await expect(page.getByText('Que dois-je comprendre après ma relecture ?')).toBeVisible();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Sceller et transmettre mon dossier' }).click();
    await expect(
      page.getByRole('heading', { name: 'Votre lecture de base peut commencer' }),
    ).toBeVisible();

    expect(sealedPayload).toMatchObject({
      birthDate: '1990-06-15',
      birthTime: '09:45',
      birthPlace: 'Lyon, France',
      specificQuestion: 'Que dois-je comprendre après ma relecture ?',
      facePhotoUrl: 's3://onboarding/user-1/face.jpg',
      palmPhotoUrl: 's3://onboarding/user-1/palm.jpg',
      profileCompleted: true,
    });
    expect(JSON.stringify(sealedPayload)).not.toContain('upload.example.test');
    expect(JSON.stringify(sealedPayload)).not.toContain('X-Amz-Signature');

    await page.getByRole('button', { name: 'Retour à mon Sanctuaire' }).click();
    await page.goto('/sanctuaire/dossier');
    await expect(page.getByText('Dossier scellé')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/protégés pendant la production/)).toBeVisible();
    await expect(page.getByRole('button', { name: /modifier/i })).toHaveCount(0);
    await expect(page.locator('img[src^="s3://"]')).toHaveCount(0);

    // The UI prevents a repeat; the API contract also returns Conflict if a stale tab retries it.
    const retryStatus = await page.evaluate(async () => {
      const response = await fetch('/api/bff/users/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileCompleted: true }),
      });
      return response.status;
    });
    expect(retryStatus).toBe(409);
    expect(secondSealAttempts).toBe(1);
  });
});
