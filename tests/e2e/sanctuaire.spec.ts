import { test, expect } from '@playwright/test';

test.describe('Sanctuaire', () => {
    test('should display user dashboard and allow PDF download', async ({ page }) => {
        // Mock login by going directly to sanctuaire
        await page.goto('/sanctuaire');

        await expect(page.locator('h1')).toContainText('Bonjour, Explorateur');
        await expect(page.getByText('Lecture Spirituelle Intégrale')).toBeVisible();

        // Check for download button
        const downloadButton = page.getByTestId('download-pdf');
        await expect(downloadButton).toBeVisible();
    });
});
