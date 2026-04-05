/**
 * E2E Tests — Sanctuaire Insights Page
 * Validates: 8 insight cards, modal open, "New" badge, audio player, auto-polling
 */
import { test, expect } from '@playwright/test';
import { mockSanctuaireAuth, mockInsightsApi } from '../helpers/api-mock';

const API_BASE = 'http://localhost:3001/api';

test.describe('Sanctuaire Insights — Display', () => {
    test.beforeEach(async ({ page }) => {
        await mockSanctuaireAuth(page, { subscribed: true });
        await mockInsightsApi(page, { withAudio: true });
    });

    test('should display 8 insight category cards', async ({ page }) => {
        await page.goto('/sanctuaire/insights');

        // Wait for insights to load
        await page.waitForTimeout(3000);

        // Should display all 8 categories
        const categories = ['Spirituel', 'Relations', 'Mission', 'Créativité', 'Émotions', 'Travail', 'Santé', 'Finance'];
        for (const cat of categories) {
            await expect(page.locator(`text=${cat}`).first()).toBeVisible({ timeout: 5000 });
        }
    });

    test('should display "New" badge on unviewed insights', async ({ page }) => {
        await mockInsightsApi(page, { allViewed: false });
        await page.goto('/sanctuaire/insights');

        await page.waitForTimeout(3000);

        // "New" or "Nouveau" badge should be visible on unviewed insights
        const newBadges = page.locator('text=/new|nouveau/i');
        const count = await newBadges.count();
        expect(count).toBeGreaterThan(0);
    });

    test('should NOT display "New" badge when all insights are viewed', async ({ page }) => {
        await mockInsightsApi(page, { allViewed: true });
        await page.goto('/sanctuaire/insights');

        await page.waitForTimeout(3000);

        const newBadges = page.locator('text=/^new$|^nouveau$/i');
        const count = await newBadges.count();
        expect(count).toBe(0);
    });

    test('should display empty state when no insights exist', async ({ page }) => {
        // Override insights mock to return empty
        await page.route(`${API_BASE}/insights`, async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        categories: [],
                        metadata: {},
                    }),
                });
            } else {
                await route.continue();
            }
        });

        await page.goto('/sanctuaire/insights');
        await page.waitForTimeout(3000);

        // Should show empty state message
        await expect(
            page.locator('text=/insights|générés|première lecture/i').first(),
        ).toBeVisible({ timeout: 5000 });
    });
});

test.describe('Sanctuaire Insights — Modal Interaction', () => {
    test('should open insight modal on card click', async ({ page }) => {
        await mockSanctuaireAuth(page, { subscribed: true });
        await mockInsightsApi(page, { withAudio: true });

        await page.goto('/sanctuaire/insights');
        await page.waitForTimeout(3000);

        // Click on first insight card
        const firstCard = page.locator('text=/spirituel/i').first();
        await firstCard.click();

        // Modal should open with full content
        await expect(
            page.locator('text=/analyse complète|résumé|guidance/i').first(),
        ).toBeVisible({ timeout: 5000 });
    });

    test('should mark insight as viewed when modal opens (PATCH call)', async ({ page }) => {
        await mockSanctuaireAuth(page, { subscribed: true });
        await mockInsightsApi(page, { allViewed: false });

        let viewPatchCalled = false;
        await page.route(/\/api\/insights\/\w+\/view/, async (route) => {
            if (route.request().method() === 'PATCH') {
                viewPatchCalled = true;
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true, viewedAt: new Date().toISOString() }),
                });
            } else {
                await route.continue();
            }
        });

        await page.goto('/sanctuaire/insights');
        await page.waitForTimeout(3000);

        const firstCard = page.locator('text=/spirituel/i').first();
        await firstCard.click();
        await page.waitForTimeout(1000);

        expect(viewPatchCalled).toBe(true);
    });
});

test.describe('Sanctuaire Insights — Audio', () => {
    test('should show audio player when audioUrl is available', async ({ page }) => {
        await mockSanctuaireAuth(page, { subscribed: true });
        await mockInsightsApi(page, { withAudio: true });

        await page.goto('/sanctuaire/insights');
        await page.waitForTimeout(3000);

        // Click an insight to open modal
        const firstCard = page.locator('text=/spirituel/i').first();
        await firstCard.click();

        // Audio player or play button should be visible
        const hasAudio = await page.locator('audio, button:has-text("Écouter"), [aria-label*="audio" i], [class*="audio" i]').first().isVisible({ timeout: 5000 }).catch(() => false);
        expect(hasAudio).toBeTruthy();
    });

    test('should poll for audio when audioUrl is null', async ({ page }) => {
        await mockSanctuaireAuth(page, { subscribed: true });

        let pollCount = 0;
        await page.route(`${API_BASE}/insights`, async (route) => {
            if (route.request().method() === 'GET') {
                pollCount++;
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        categories: [
                            {
                                category: 'SPIRITUEL',
                                metadata: { label: 'Spirituel', description: 'Éveil', icon: 'Sparkles', color: 'horizon' },
                                insight: {
                                    id: 'ins-1',
                                    category: 'SPIRITUEL',
                                    short: 'Short text',
                                    full: 'Full text',
                                    audioUrl: pollCount > 2 ? 'https://s3.example.com/audio.mp3' : null,
                                    viewedAt: null,
                                },
                                isNew: true,
                            },
                        ],
                        metadata: {},
                    }),
                });
            } else {
                await route.continue();
            }
        });

        await page.goto('/sanctuaire/insights');

        // Wait for at least 2 polling cycles (useInsights polls every 10s)
        await page.waitForTimeout(25000);

        // Should have polled multiple times
        expect(pollCount).toBeGreaterThan(1);
    });
});
