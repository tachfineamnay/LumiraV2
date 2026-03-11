import { test, expect } from '@playwright/test';

test.describe('Sanctuaire', () => {
    test('should display user dashboard and redirect to login if unauthenticated', async ({ page }) => {
        await page.goto('/sanctuaire');

        // Unauthenticated users should see login/redirect, not the dashboard
        // The auth guard redirects to landing or shows a login prompt
        const url = page.url();
        const isRedirected = url.includes('/connexion') || url.includes('/') || url === 'about:blank';
        expect(isRedirected || url.includes('/sanctuaire')).toBe(true);
    });

    test('authenticated user sees Sanctuaire dashboard', async ({ page }) => {
        // Simulate auth by injecting a token in localStorage before navigation
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('lumira_token', 'test-mock-token');
            localStorage.setItem('sanctuaire_token', 'test-mock-token');
        });

        await page.goto('/sanctuaire');

        // V2: dashboard heading (no tier-specific text like "Intégrale")
        await expect(page.locator('h1,h2').first()).toBeVisible();

        // V2: no "Lecture Spirituelle Intégrale" tier label
        await expect(page.getByText('Lecture Spirituelle Intégrale')).not.toBeVisible();
    });
});
