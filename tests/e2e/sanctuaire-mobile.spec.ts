/** E2E — mobile-first Sanctuaire shell. */
import { test, expect, type Page } from '@playwright/test';
import { mockFullSanctuaire } from '../helpers/api-mock';

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(doc.scrollWidth, document.body.scrollWidth) - window.innerWidth;
  });
  expect(overflow).toBeLessThanOrEqual(2);
}

test.describe('Sanctuaire mobile — navigation essentielle', () => {
  test.beforeEach(async ({ page }) => {
    await mockFullSanctuaire(page, { profileCompleted: true });
  });

  test('keeps the five primary destinations visible', async ({ page }) => {
    await page.goto('/sanctuaire');

    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    await expect(nav).toBeVisible({ timeout: 20_000 });
    await expect(nav.getByRole('link', { name: 'Accueil' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Dossier' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Lectures' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Synthèse' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Éclairage' })).toBeVisible();
    await expect(nav.getByText(/chemin|rêves|plus/i)).toHaveCount(0);
    await assertNoHorizontalOverflow(page);
  });

  test('keeps the reply composer above the bottom navigation', async ({ page }) => {
    await page.goto('/sanctuaire/chat');

    await expect(page.getByRole('heading', { name: 'Demander un éclairage' })).toBeVisible({
      timeout: 20_000,
    });

    const input = page.getByLabel('Ajouter un message');
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    await expect(input).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Envoyer mon message au Desk' })).toBeVisible();

    await input.scrollIntoViewIfNeeded();

    const [inputBox, navBox] = await Promise.all([input.boundingBox(), nav.boundingBox()]);
    expect(inputBox).toBeTruthy();
    expect(navBox).toBeTruthy();
    if (inputBox && navBox) expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(navBox.y + 8);
    await assertNoHorizontalOverflow(page);
  });
});
