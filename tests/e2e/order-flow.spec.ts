import { test, expect } from '@playwright/test';
import { TEST_USER } from '../fixtures/test-user';

test.describe('Order Flow', () => {
    test('complete order with Mystique level', async ({ page }) => {
        // 1. Landing
        await page.goto('/');
        await expect(page.locator('h1')).toContainText('LUMIRA');

        // 2. Select level (Mock path: redirect to /commande)
        await page.goto('/commande');

        // 3. Fill form step 1
        await page.fill('[name="firstName"]', TEST_USER.firstName);
        await page.fill('[name="lastName"]', TEST_USER.lastName);
        await page.fill('[name="email"]', TEST_USER.email);
        await page.click('[data-testid="next-step"]');

        // 4. Payment (Stripe placeholder in current UI)
        await expect(page.getByText('Finalisez votre commande')).toBeVisible();
        await page.click('[data-testid="submit-payment"]');

        // 5. Confirmation
        await expect(page.getByTestId('order-number')).toBeVisible();
        await expect(page.getByText("C'est fait !")).toBeVisible();
    });
});
