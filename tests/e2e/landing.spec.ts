import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
    test('should display main title and tagline', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('h1')).toContainText('LUMIRA');
        await expect(page.getByText('La nouvelle fondation de la cartographie vibratoire spirituelle')).toBeVisible();
    });

    test('should display vibrating catalog categories', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('level-p-init')).toBeVisible();
        await expect(page.getByTestId('level-p-itgr')).toBeVisible();
    });
});
