import { expect, test, type Locator } from '@playwright/test';
import { expectNoHorizontalOverflow } from './helpers/layout';

async function expectVisibleInViewport(locator: Locator) {
  const box = await locator.boundingBox();
  const viewport = locator.page().viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.y).toBeLessThanOrEqual(viewport!.height);
  expect(box!.y + box!.height).toBeGreaterThanOrEqual(0);
}

test('keeps the public entry points reachable at the configured viewport', async ({ page }) => {
  await page.route('**/api/auth/sanctuaire/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      body: JSON.stringify({ authenticated: false }),
    }),
  );

  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const menuButton = page.getByRole('button', { name: 'Ouvrir le menu' });
  if (await menuButton.isVisible()) {
    await menuButton.click();
    const menu = page.getByRole('dialog', { name: 'Navigation principale' });
    await expect(menu).toBeVisible();
    await expectVisibleInViewport(menu.getByRole('link', { name: "L'Offre" }));
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(menuButton).toBeFocused();
  } else {
    await expectVisibleInViewport(page.getByRole('link', { name: 'Commencer', exact: true }));
  }

  await page.goto('/sanctuaire/login');
  const email = page.getByLabel('Email de commande');
  await expect(email).toBeVisible();
  await expect(email).toHaveAttribute('autocomplete', 'email');
  await expectVisibleInViewport(email);
  await expectNoHorizontalOverflow(page);
});
