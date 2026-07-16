import { test, expect } from '@playwright/test';
import { TEST_USER } from '../fixtures/test-user';

test.describe('Order Flow — lifetime access', () => {
  test.describe.configure({ mode: 'serial' });

  test('landing → checkout form → payment intent', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Lumira', exact: true })).toBeVisible();

    // Checkout checks for a prior Sanctuaire session. This scenario covers a new buyer.
    await page.route('**/api/bff/users/profile', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthenticated' }),
      });
    });
    await page.goto('/commande');
    await expect(page.getByText('paiement unique', { exact: true })).toBeVisible();
    await expect(page.getByText(/accès à vie/i)).toBeVisible();
    await expect(page.getByTestId('level-p-init')).not.toBeVisible();
    await expect(page.getByTestId('level-p-itgr')).not.toBeVisible();
    await page.locator('[name="firstName"]').fill(TEST_USER.firstName);
    await page.locator('[name="lastName"]').fill(TEST_USER.lastName);
    await page.locator('[name="email"]').fill(TEST_USER.email);
    await page.locator('[name="phone"]').fill('06 12 34 56 78');

    let checkoutPayload: unknown;
    await page.route('**/api/bff/payments/checkout-intent', async (route) => {
      checkoutPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ clientSecret: 'pi_test_secret_for_e2e' }),
      });
    });

    await page.getByRole('button', { name: /payer 29€/i }).click();

    await expect(page.getByText('Paiement sécurisé', { exact: true })).toBeVisible();
    expect(checkoutPayload).toMatchObject({
      email: TEST_USER.email,
      firstName: TEST_USER.firstName,
      lastName: TEST_USER.lastName,
      productLevel: '4',
    });
  });
});
