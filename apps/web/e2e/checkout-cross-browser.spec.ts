import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoHorizontalOverflow } from './helpers/layout';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'cache-control': 'no-store' },
    body: JSON.stringify(body),
  });
}

async function installAnonymousCheckoutMocks(page: Page) {
  await page.route('**/api/bff/users/profile', (route) =>
    route.fulfill({ status: 401, headers: { 'cache-control': 'no-store' } }),
  );
  await page.route('**/api/bff/payments/checkout-status', (route) =>
    json(route, {
      paymentIntentId: 'pi_test_cross_browser',
      paymentMayBePending: false,
      status: 'requires_payment_method',
      stripeMode: 'test',
    }),
  );
}

async function completeIdentity(page: Page, email = 'cross-browser@lumira.test') {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Téléphone').fill('+33612345678');
  await page.getByLabel('Prénom').fill('Ariane');
  await page.getByLabel('Nom', { exact: true }).fill('Responsive');
}

test('opens the Stripe payment step in every primary browser project', async ({ page }) => {
  await installAnonymousCheckoutMocks(page);
  await page.route('**/api/bff/payments/checkout-intent', (route) =>
    json(route, {
      clientSecret: 'pi_test_cross_browser_secret_payment',
      stripeMode: 'test',
    }),
  );

  await page.goto('/commande');
  await completeIdentity(page);
  await page.getByRole('button', { name: 'Payer 17€' }).click();

  const paymentElement = page.getByTestId('stripe-payment-element');
  await expect(paymentElement).toBeVisible();
  await paymentElement.scrollIntoViewIfNeeded();
  await expectNoHorizontalOverflow(page);
});

test('double activation creates one checkout intent and the attempt survives reload', async ({ page }) => {
  await installAnonymousCheckoutMocks(page);
  let intentCalls = 0;

  await page.route('**/api/bff/payments/checkout-intent', async (route) => {
    intentCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 200));
    await json(route, {
      clientSecret: 'pi_test_cross_browser_secret_resume',
      stripeMode: 'test',
    });
  });

  await page.goto('/commande');
  await completeIdentity(page, 'resume-cross-browser@lumira.test');
  const paymentButton = page.getByRole('button', { name: 'Payer 17€' });
  await paymentButton.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });

  await expect.poll(() => intentCalls).toBe(1);
  await expect(page.getByTestId('stripe-payment-element')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('stripe-payment-element')).toBeVisible();
  await expect.poll(() => intentCalls).toBe(1);
  await expectNoHorizontalOverflow(page);
});

test('a delayed profile fills untouched fields without replacing customer input', async ({ page }) => {
  let releaseProfile: (() => void) | undefined;
  const profilePending = new Promise<void>((resolve) => {
    releaseProfile = resolve;
  });

  await page.route('**/api/bff/users/profile', async (route) => {
    await profilePending;
    await json(route, {
      email: 'profile@lumira.test',
      firstName: 'Ariane',
      lastName: 'Profil',
      phone: '+212612345678',
    });
  });

  await page.goto('/commande');
  await page.getByLabel('Email').fill('customer-wins@lumira.test');
  releaseProfile?.();

  await expect(page.getByLabel('Email')).toHaveValue('customer-wins@lumira.test');
  await expect(page.getByLabel('Prénom')).toHaveValue('Ariane');
  await expect(page.getByLabel('Nom', { exact: true })).toHaveValue('Profil');
  await expect(page.getByLabel('Téléphone')).toHaveValue('+212612345678');
});
