import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
    test('should display main title and tagline', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('h1')).toContainText('LUMIRA');
        await expect(page.getByText('La nouvelle fondation de la cartographie vibratoire spirituelle')).toBeVisible();
    });

    test('should display single subscription offer at 29€', async ({ page }) => {
        await page.goto('/');

        // V2: single offer, no tier cards
        await expect(page.getByTestId('level-p-init')).not.toBeVisible();
        await expect(page.getByTestId('level-p-itgr')).not.toBeVisible();

        // Single CTA to start subscription
        await expect(page.getByText('29')).toBeVisible();
    });

    test('CTA navigates to /commande', async ({ page }) => {
        await page.goto('/');
        const cta = page.getByRole('link', { name: /commencer|découvrir|s'abonner|accéder/i }).first();
        await expect(cta).toBeVisible();
    });
});
