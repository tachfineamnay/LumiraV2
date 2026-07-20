import { expect, test, type Page } from '@playwright/test';
import { mockSanctuaireAuth } from '../helpers/api-mock';

const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z',
  'base64',
);

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    return documentWidth - window.innerWidth;
  });
  expect(overflow).toBeLessThanOrEqual(2);
}

test.describe('Sanctuaire — brouillon de dossier scellable', () => {
  test('persists a private intake draft across a browser restart and keeps mobile actions reachable', async ({
    page,
  }) => {
    await mockSanctuaireAuth(page, { profileCompleted: false, orderStatus: 'PAID' });

    let draft: { currentStep: number; status: 'IN_PROGRESS'; data: Record<string, unknown> } = {
      currentStep: 0,
      status: 'IN_PROGRESS',
      data: {},
    };
    const savedDrafts: Array<Record<string, unknown>> = [];

    await page.route('**/api/bff/users/onboarding', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(draft) });
        return;
      }

      const body = route.request().postDataJSON() as {
        currentStep: number;
        data: Record<string, unknown>;
      };
      savedDrafts.push(body.data);
      draft = { currentStep: body.currentStep, status: 'IN_PROGRESS', data: body.data };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(draft) });
    });

    await page.goto('/sanctuaire');
    if ((await page.evaluate(() => window.innerWidth)) < 768) {
      await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible({
        timeout: 20_000,
      });
    }
    await expect(page.getByRole('button', { name: 'Reprendre mon dossier' })).toBeVisible();
    await page.getByRole('button', { name: 'Reprendre mon dossier' }).click();

    await expect(page.getByRole('heading', { name: 'Vous gardez la main' })).toBeVisible();
    await page.getByRole('button', { name: 'Commencer mon dossier' }).click();
    await page.getByLabel('Date de naissance').fill('1990-06-15');
    await page.getByLabel('Heure (facultative)').fill('09:45');
    await page.getByLabel('Lieu de naissance').fill('Lyon, France');
    await page.getByRole('button', { name: 'Continuer' }).click();

    await page.getByLabel(/Votre question/).fill('Que dois-je comprendre dans cette transition ?');
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

    await page.getByLabel(/Ce qui vous porte/).fill('Ma créativité et mes proches.');
    await page.getByLabel(/Ce qui vous freine/).fill('Le doute avant une décision importante.');
    await expect(page.getByText('Brouillon sauvegardé')).toBeVisible({ timeout: 4_000 });
    expect(savedDrafts.at(-1)).toMatchObject({
      birthDate: '1990-06-15',
      birthPlace: 'Lyon, France',
      specificQuestion: 'Que dois-je comprendre dans cette transition ?',
    });
    await assertNoHorizontalOverflow(page);

    const continueButton = page.getByRole('button', { name: 'Continuer' });
    const bounds = await continueButton.boundingBox();
    expect(bounds?.y).toBeGreaterThanOrEqual(0);
    expect((bounds?.y || 0) + (bounds?.height || 0)).toBeLessThanOrEqual(
      (await page.evaluate(() => window.innerHeight)) + 2,
    );

    // Equivalent to closing the browser: only server-side draft state is used on return.
    await page.getByRole('button', { name: 'Fermer et reprendre plus tard' }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Reprendre mon dossier' })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: 'Reprendre mon dossier' }).click();
    await expect(page.getByRole('heading', { name: 'Votre contexte personnel' })).toBeVisible();
    await expect(page.getByLabel(/Ce qui vous porte/)).toHaveValue('Ma créativité et mes proches.');
    await expect(page.getByRole('img', { name: 'Visage' })).toHaveCount(0);
  });
});
