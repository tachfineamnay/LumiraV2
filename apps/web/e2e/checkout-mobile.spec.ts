import { expect, test, type Locator, type Page } from '@playwright/test';

test.describe.configure({ timeout: 60_000 });

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

async function expectIntersectsViewport(locator: Locator) {
  const box = await locator.boundingBox();
  const viewport = locator.page().viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeLessThanOrEqual(viewport!.width);
  expect(box!.x + box!.width).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeLessThanOrEqual(viewport!.height);
  expect(box!.y + box!.height).toBeGreaterThanOrEqual(0);
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

test('mobile menu anchor keeps pricing section visible after closing', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Chromium-only anchor regression check');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');

  await page.evaluate(() => window.scrollTo(0, 680));
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click({ force: true });
  const menu = page.getByRole('dialog', { name: 'Navigation principale' });
  await expect(menu).toBeVisible();
  await menu.getByRole('link', { name: "Commencer l'expérience" }).click();
  await expect(menu).toBeHidden();
  await expect(page).toHaveURL(/#niveaux$/);
  await expect
    .poll(async () => {
      const box = await page.locator('#niveaux').boundingBox();
      return box ? box.y <= (page.viewportSize()?.height ?? 0) && box.y + box.height >= 0 : false;
    })
    .toBe(true);
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

test('checkout creates one intent for a double tap and resumes that same attempt after refresh', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Pixel 5-only checkout flow');
  let intentCalls = 0;

  await page.route('**/api/bff/users/profile', (route) => route.fulfill({ status: 401 }));
  await page.route('**/api/bff/payments/checkout-intent', async (route) => {
    intentCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ clientSecret: 'pi_test_resume_secret_mobile' }),
    });
  });

  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/commande');
  await page.getByPlaceholder('votre@email.com').fill('resume@example.com');
  await page.getByPlaceholder('Prénom').fill('Maya');
  await page.getByPlaceholder('Nom', { exact: true }).fill('Resume');

  const startPayment = page.getByRole('button', { name: 'Payer 17€' });
  await startPayment.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect.poll(() => intentCalls).toBe(1);
  await expect(page.getByTestId('stripe-payment-element')).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('stripe-payment-element')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('payment return retries access finalization without creating another checkout intent', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Chromium-only return state check');
  let confirmCalls = 0;
  let checkoutIntentCalls = 0;

  await page.route('**/api/bff/payments/checkout-intent', async (route) => {
    checkoutIntentCalls += 1;
    await route.fulfill({ status: 500 });
  });
  await page.route('**/api/bff/payments/confirm-checkout', async (route) => {
    confirmCalls += 1;
    await route.fulfill({ status: 503, body: 'temporary failure' });
  });

  await page.addInitScript(() => {
    sessionStorage.setItem(
      'lumira_checkout_attempt_v1',
      JSON.stringify({
        checkoutAttemptId: '11111111-1111-4111-8111-111111111111',
        clientSecret: 'pi_test_return_secret_checkout',
        paymentIntentId: 'pi_test_return',
        phase: 'finalizing',
        updatedAt: new Date().toISOString(),
      }),
    );
  });

  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/payment-success?payment_intent=pi_test_return');
  await expect(page.getByRole('heading', { name: 'Accès à vérifier' })).toBeVisible();
  await expect(page.getByText(/ne payez pas une seconde fois/i)).toBeVisible();
  await page.getByRole('button', { name: /vérifier mon accès sans repayer/i }).click();
  await expect.poll(() => confirmCalls).toBe(2);
  expect(checkoutIntentCalls).toBe(0);
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
