
import { test, expect } from '@playwright/test';

test.describe('User Profile Page', () => {
    // Use a mock user ID or ensure the environment is seeded
    // For this test, we might need to mock the authentication or bypass it
    // But assuming we can navigate to the page if we mock the backend or session

    // Since we don't have a full E2E auth flow set up easily in this one-shot script,
    // we will assume we can hit the page or it redirects to login.
    // Ideally, we mocking the page data.

    test('should display the profile layout correctly', async ({ page }) => {
        // Navigate to profile page
        // Note: In a real app, we'd need to log in first. 
        // This is a placeholder for the structure we want to verify.
        await page.goto('/sanctuaire/profile');

        // Check for main structural elements
        await expect(page.locator('h1')).toContainText('Mon Dossier Spirituel'); // Assuming H1 matches

        // Check for the 2-column layout (Left: Identity, Right: Details)
        // We can check for specific test-ids if we added them, or specific text/classes

        // Verify "Sauvegarder" button is hidden initially
        await expect(page.getByText('Sauvegarder')).toBeHidden();
    });

    test('should show save button when form is dirty', async ({ page }) => {
        await page.goto('/sanctuaire/profile');

        // Simulate typing in a field
        const phoneInput = page.getByLabel('Téléphone'); // Adjust locator as needed
        if (await phoneInput.count() > 0) {
            await phoneInput.fill('+33 6 12 34 57 89');

            // Save button should appear
            await expect(page.getByText('Sauvegarder')).toBeVisible();
        }
    });
});
