import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
    test('should display brand and portal CTA', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('h1').filter({ hasText: 'Oracle' })).toBeVisible();
        await expect(page.locator('h1').filter({ hasText: 'Lumira' })).toBeVisible();
        await expect(page.getByText('Ouvrir le Portail')).toBeVisible();
    });

    test('should display single subscription offer at 29€', async ({ page }) => {
        await page.goto('/');

        // V2: single offer, no tier cards
        await expect(page.getByTestId('level-p-init')).not.toBeVisible();
        await expect(page.getByTestId('level-p-itgr')).not.toBeVisible();

        // Single CTA to start subscription
        await expect(page.getByText('29')).toBeVisible();
    });

    test('CTA opens portal / subscription section', async ({ page }) => {
        await page.goto('/');
        const cta = page.getByRole('link', { name: /ouvrir le portail|commencer mon voyage/i }).first();
        await expect(cta).toBeVisible();
    });
});
