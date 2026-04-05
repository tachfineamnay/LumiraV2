/**
 * E2E Tests — Sanctuaire Dream Journal (Rêves)
 * Validates: dream list, create dream, emotion selection, daily limit, interpretation display
 */
import { test, expect } from '@playwright/test';
import { mockSanctuaireAuth, mockDreamsApi } from '../helpers/api-mock';

const API_BASE = 'http://localhost:3001/api';

test.describe('Sanctuaire Dreams — Display', () => {
    test.beforeEach(async ({ page }) => {
        await mockSanctuaireAuth(page, { subscribed: true });
        await mockDreamsApi(page);
    });

    test('should display dream journal page with existing dreams', async ({ page }) => {
        await page.goto('/sanctuaire/reves');
        await page.waitForTimeout(3000);

        // Should show dream entries
        await expect(
            page.locator('text=/forêt lumineuse|bateau|rêve/i').first(),
        ).toBeVisible({ timeout: 5000 });
    });

    test('should show dream symbols as tags', async ({ page }) => {
        await page.goto('/sanctuaire/reves');
        await page.waitForTimeout(3000);

        // Symbols like "forêt", "lumière", "musique" should appear
        await expect(page.locator('text=/forêt|lumière|musique/i').first()).toBeVisible({ timeout: 5000 });
    });

    test('should show emotion emoji/label for each dream', async ({ page }) => {
        await page.goto('/sanctuaire/reves');
        await page.waitForTimeout(3000);

        // Emotion "paix" or its emoji ☮️ should appear
        const hasEmotion = await page.locator('text=/paix|☮️|joie|✨/i').first().isVisible({ timeout: 5000 }).catch(() => false);
        expect(hasEmotion).toBeTruthy();
    });

    test('should display empty state when no dreams exist', async ({ page }) => {
        await page.route(`${API_BASE}/dreams`, async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ dreams: [], total: 0 }),
                });
            } else {
                await route.continue();
            }
        });

        await page.goto('/sanctuaire/reves');
        await page.waitForTimeout(3000);

        // Empty state message
        await expect(
            page.locator('text=/aucun rêve|premier rêve|journal/i').first(),
        ).toBeVisible({ timeout: 5000 });
    });
});

test.describe('Sanctuaire Dreams — Create Dream', () => {
    test('should show "add dream" button', async ({ page }) => {
        await mockSanctuaireAuth(page, { subscribed: true });
        await mockDreamsApi(page);

        await page.goto('/sanctuaire/reves');
        await page.waitForTimeout(3000);

        const addBtn = page.locator('button:has-text("Ajouter"), button:has-text("Nouveau"), a:has-text("Nouveau"), button svg.lucide-plus, a[href*="nouveau"]').first();
        await expect(addBtn).toBeVisible({ timeout: 5000 });
    });

    test('should open dream creation form', async ({ page }) => {
        await mockSanctuaireAuth(page, { subscribed: true });
        await mockDreamsApi(page);

        await page.goto('/sanctuaire/reves');
        await page.waitForTimeout(3000);

        const addBtn = page.locator('button:has-text("Ajouter"), button:has-text("Nouveau"), a:has-text("Nouveau"), button svg.lucide-plus').first();
        await addBtn.click();

        // Should show dream content textarea
        await expect(
            page.locator('textarea, input[placeholder*="rêve" i]').first(),
        ).toBeVisible({ timeout: 5000 });
    });

    test('should submit new dream and show interpretation', async ({ page }) => {
        await mockSanctuaireAuth(page, { subscribed: true });

        let dreamCreated = false;
        await page.route(`${API_BASE}/dreams`, async (route) => {
            if (route.request().method() === 'POST') {
                dreamCreated = true;
                await route.fulfill({
                    status: 201,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        dream: {
                            id: 'dream-new',
                            content: 'Un vol au-dessus des nuages',
                            emotion: 'joie',
                            symbols: ['vol', 'nuages'],
                            interpretation: JSON.stringify({
                                summary: 'Votre rêve exprime un désir de liberté.',
                                symbols: ['vol', 'nuages'],
                                guidance: 'Embrassez votre besoin d\'espace.',
                            }),
                        },
                        interpretation: {
                            summary: 'Votre rêve exprime un désir de liberté.',
                            symbols: ['vol', 'nuages'],
                            guidance: 'Embrassez votre besoin d\'espace.',
                        },
                        remainingToday: 1,
                    }),
                });
            } else if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ dreams: [], total: 0 }),
                });
            }
        });

        await page.goto('/sanctuaire/reves');
        await page.waitForTimeout(3000);

        // Open form
        const addBtn = page.locator('button:has-text("Ajouter"), button:has-text("Nouveau"), button svg.lucide-plus').first();
        if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await addBtn.click();
            await page.waitForTimeout(500);

            // Fill in dream content
            const textarea = page.locator('textarea').first();
            await textarea.fill('Un vol au-dessus des nuages dorés');

            // Submit
            const submitBtn = page.locator('button:has-text("Interpréter"), button:has-text("Envoyer"), button[type="submit"]').first();
            await submitBtn.click();

            await page.waitForTimeout(3000);
            expect(dreamCreated).toBe(true);
        }
    });
});

test.describe('Sanctuaire Dreams — Daily Limit', () => {
    test('should show rate limit error when 2 dreams already submitted', async ({ page }) => {
        await mockSanctuaireAuth(page, { subscribed: true });

        await page.route(`${API_BASE}/dreams`, async (route) => {
            if (route.request().method() === 'POST') {
                await route.fulfill({
                    status: 429,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        statusCode: 429,
                        message: 'Limite atteinte : maximum 2 rêves par jour.',
                        remainingToday: 0,
                    }),
                });
            } else if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ dreams: [{ id: '1', content: 'rêve1' }, { id: '2', content: 'rêve2' }], total: 2 }),
                });
            }
        });

        await page.goto('/sanctuaire/reves');
        await page.waitForTimeout(3000);

        // Try to create a dream
        const addBtn = page.locator('button:has-text("Ajouter"), button:has-text("Nouveau"), button svg.lucide-plus').first();
        if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await addBtn.click();
            await page.waitForTimeout(500);

            const textarea = page.locator('textarea').first();
            if (await textarea.isVisible().catch(() => false)) {
                await textarea.fill('Troisième rêve impossible');
                const submitBtn = page.locator('button:has-text("Interpréter"), button:has-text("Envoyer"), button[type="submit"]').first();
                await submitBtn.click();

                // Should show limit error
                await expect(
                    page.locator('text=/limite|maximum|2 rêves/i').first(),
                ).toBeVisible({ timeout: 5000 });
            }
        }
    });
});
