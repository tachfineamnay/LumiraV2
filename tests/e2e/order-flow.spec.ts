import { test, expect } from '@playwright/test';
import { TEST_USER } from '../fixtures/test-user';

test.describe('Order Flow V2', () => {
    test('landing → commande → Stripe redirect (Happy Path)', async ({ page }) => {
        // 1. Landing page loads
        await page.goto('/');
        await expect(page.locator('h1')).toContainText('LUMIRA');

        // 2. Navigate directly to /commande (single subscription offer, no tier selection)
        await page.goto('/commande');

        // 3. Fill onboarding form — no tier/depth selection in V2
        await page.fill('[name="firstName"]', TEST_USER.firstName);
        await page.fill('[name="lastName"]', TEST_USER.lastName);
        await page.fill('[name="email"]', TEST_USER.email);
        await page.click('[data-testid="next-step"]');

        // 4. Mock the Stripe checkout API call
        await page.route('**/subscriptions/checkout', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ url: 'https://checkout.stripe.com/pay/test_mock_session' }),
            });
        });

        // 5. Submit to trigger checkout redirect
        await page.click('[data-testid="submit-checkout"]');

        // 6. Assert the page navigated toward Stripe checkout
        await page.waitForURL(/checkout\.stripe\.com|payment-success/, { timeout: 10000 });
    });

    test('commande page shows single 29€ offer — no tier cards', async ({ page }) => {
        await page.goto('/commande');

        // V2: no tier selection UI
        await expect(page.getByTestId('level-p-init')).not.toBeVisible();
        await expect(page.getByTestId('level-p-itgr')).not.toBeVisible();

        // V2: single subscription offer visible
        await expect(page.getByText('29')).toBeVisible();
    });
});
