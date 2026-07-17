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

  test('keeps the four primary destinations visible', async ({ page }) => {
    await page.goto('/sanctuaire');

    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    await expect(nav).toBeVisible({ timeout: 20_000 });
    await expect(nav.getByRole('link', { name: 'Accueil' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Lectures' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Synthèse' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Éclairage' })).toBeVisible();
    await expect(nav.getByText(/chemin|rêves|plus/i)).toHaveCount(0);
    await assertNoHorizontalOverflow(page);
  });

  test('keeps the message composer above the bottom navigation', async ({ page }) => {
    await page.goto('/sanctuaire/chat');

    const input = page.getByLabel('Votre question');
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    await expect(input).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole('button', { name: 'Envoyer ma demande d’éclairage' }),
    ).toBeVisible();

    const [inputBox, navBox] = await Promise.all([input.boundingBox(), nav.boundingBox()]);
    expect(inputBox).toBeTruthy();
    expect(navBox).toBeTruthy();
    if (inputBox && navBox) expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(navBox.y + 8);
    await assertNoHorizontalOverflow(page);
  });
});
