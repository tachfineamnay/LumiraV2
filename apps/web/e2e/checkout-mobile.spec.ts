import { expect, test, type Locator, type Page } from '@playwright/test';

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
}

async function scrollIntoView(locator: Locator) {
  await locator.evaluate((element) =>
    element.scrollIntoView({ block: 'center', inline: 'nearest' }),
  );
}

async function expectInViewport(locator: Locator) {
  await scrollIntoView(locator);
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual((await locator.page().viewportSize())!.width);
}

test('landing stays usable at 320 × 568 in Chromium', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Chromium-only viewport check');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');

  await page.evaluate(() => window.scrollTo(0, 680));
  const menuButton = page.getByRole('button', { name: 'Ouvrir le menu' });
  await menuButton.click({ force: true });
  const menu = page.getByRole('dialog', { name: 'Navigation principale' });
  await expect(menu).toBeVisible();
  for (const name of [
    "L'Offre",
    'Comment ça marche',
    'Témoignages',
    'Connexion',
    "Commencer l'expérience",
  ]) {
    await expectInViewport(menu.getByRole('link', { name }));
  }
  await page.getByRole('button', { name: 'Fermer le menu' }).click({ force: true });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(600);

  await scrollIntoView(page.locator('#niveaux'));
  await expect(page.getByText('97€', { exact: true })).toBeVisible();
  await expect(page.getByText('paiement unique', { exact: true })).toBeVisible();
  await expectInViewport(page.locator('#niveaux a[href="/commande"]'));
  await expectNoHorizontalOverflow(page);
});

test('menu remains reachable on a short landscape viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Chromium-only viewport check');
  await page.setViewportSize({ width: 568, height: 320 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click({ force: true });

  const menu = page.getByRole('dialog', { name: 'Navigation principale' });
  await scrollIntoView(menu.getByRole('link', { name: "Commencer l'expérience" }));
  await expectInViewport(menu.getByRole('link', { name: "Commencer l'expérience" }));
  await expectNoHorizontalOverflow(page);
});

test('Pixel 5 reaches the visible payment step with a reduced viewport', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Pixel 5-only checkout flow');
  await page.route('**/api/bff/users/profile', (route) => route.fulfill({ status: 401 }));
  await page.route('**/api/bff/payments/checkout-intent', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ clientSecret: 'pi_test_checkout_secret_mobile' }),
    }),
  );

  await page.goto('/commande');
  await page.goto('/');
  const landingCta = page.locator('#niveaux a[href="/commande"]');
  await expect(landingCta).toHaveAttribute('href', '/commande');
  await page.goto('/commande');
  await expect(page).toHaveURL(/\/commande$/);
  await page.setViewportSize({ width: 393, height: 420 });

  await page.getByPlaceholder('votre@email.com').fill('mobile@example.com');
  await page.getByPlaceholder('Prénom').fill('Maya');
  await page.getByPlaceholder('Nom', { exact: true }).fill('Mobile');
  const nextButton = page.getByRole('button', { name: 'Payer 17€' });
  await expectInViewport(nextButton);
  await nextButton.click();

  const paymentBlock = page.getByTestId('stripe-payment-element');
  await expect(paymentBlock).toBeVisible();
  await expectInViewport(paymentBlock);
  await expectNoHorizontalOverflow(page);
});

test('landing stays usable in mobile WebKit', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-webkit', 'Mobile WebKit-only landing check');
  await page.goto('/');
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click({ force: true });
  await expect(page.getByRole('dialog', { name: 'Navigation principale' })).toBeVisible();
  await page.getByRole('button', { name: 'Fermer le menu' }).click({ force: true });
  await scrollIntoView(page.locator('#niveaux'));
  await expect(page.getByText('97€', { exact: true })).toBeVisible();
  await expectInViewport(page.locator('#niveaux a[href="/commande"]'));
  await expectNoHorizontalOverflow(page);
});

test('desktop pricing remains visible', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop Chromium check');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await scrollIntoView(page.locator('#niveaux'));
  await expect(page.getByText('paiement unique', { exact: true })).toBeVisible();
  await expectInViewport(page.locator('#niveaux a[href="/commande"]'));
  await expectNoHorizontalOverflow(page);
});
