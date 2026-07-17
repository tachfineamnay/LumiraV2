/**
 * E2E Tests — Sanctuaire Insights (canonical: /sanctuaire/synthesis)
 * Validates: redirect from legacy URL, 8 insight cards, modal, "New" badge, audio
 */
import { test, expect } from '@playwright/test';
import { mockInsightsApi, mockFullSanctuaire } from '../helpers/api-mock';

const BFF = '**/api/bff';
const INSIGHTS_URL = '/sanctuaire/synthesis';

test.describe('Sanctuaire Insights — Legacy redirect', () => {
    test('should redirect /sanctuaire/insights to synthesis', async ({ page }) => {
        await mockFullSanctuaire(page, { subscribed: true });
        await page.goto('/sanctuaire/insights');
        await page.waitForURL('**/sanctuaire/synthesis', { timeout: 10000 });
        expect(page.url()).toContain('/sanctuaire/synthesis');
    });
});

test.describe('Sanctuaire Insights — Display', () => {
    test.beforeEach(async ({ page }) => {
        await mockFullSanctuaire(page, { subscribed: true });
    });

    test('should display 8 insight category cards', async ({ page }) => {
        await page.goto(INSIGHTS_URL);
        await page.waitForTimeout(3000);

        const categories = [
            'Spirituel',
            'Relations',
            'Mission',
            'Créativité',
            'Émotions',
            'Travail',
            'Santé',
            'Finance',
        ];
        for (const cat of categories) {
            await expect(page.locator(`text=${cat}`).first()).toBeVisible({ timeout: 5000 });
        }
    });

    test('should display "New" badge on unviewed insights', async ({ page }) => {
        await mockInsightsApi(page, { allViewed: false });
        await page.goto(INSIGHTS_URL);
        await page.waitForTimeout(3000);

        const newBadges = page.locator('text=/new|nouveau/i');
        const count = await newBadges.count();
        expect(count).toBeGreaterThan(0);
    });

    test('should NOT display "New" badge when all insights are viewed', async ({ page }) => {
        await mockInsightsApi(page, { allViewed: true });
        await page.goto(INSIGHTS_URL);
        await page.waitForTimeout(3000);

        const newBadges = page.locator('text=/^new$|^nouveau$/i');
        const count = await newBadges.count();
        expect(count).toBe(0);
    });

    test('should display empty state when no insights exist', async ({ page }) => {
        await page.route(`${BFF}/insights`, async (route) => {
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

        await page.goto(INSIGHTS_URL);
        await page.waitForTimeout(3000);

        await expect(
            page.locator('text=/insights|génération|première lecture|essence/i').first(),
        ).toBeVisible({ timeout: 5000 });
    });
});

test.describe('Sanctuaire Insights — Modal Interaction', () => {
    test('should open insight modal on card click', async ({ page }) => {
        await mockFullSanctuaire(page, { subscribed: true });

        await page.goto(INSIGHTS_URL);
        await page.waitForTimeout(3000);

        await page.getByRole('button', { name: 'Explorer' }).first().click();

        await expect(
            page.locator('text=/analyse complète|résumé|guidance/i').first(),
        ).toBeVisible({ timeout: 5000 });
    });

    test('should mark insight as viewed when modal opens (PATCH call)', async ({ page }) => {
        await mockFullSanctuaire(page, { subscribed: true });
        await mockInsightsApi(page, { allViewed: false });

        await page.goto(INSIGHTS_URL);
        await page.waitForTimeout(3000);

        const viewRequest = page.waitForRequest(
            (request) =>
                request.method() === 'PATCH' &&
                /\/api\/bff\/insights\/\w+\/view/.test(request.url()),
        );
        await page.getByRole('button', { name: 'Explorer' }).first().click();
        await expect(viewRequest).resolves.toBeTruthy();
    });
});

test.describe('Sanctuaire Insights — Audio', () => {
    test('should show audio player when audioUrl is available', async ({ page }) => {
        await mockFullSanctuaire(page, { subscribed: true });

        await page.goto(INSIGHTS_URL);
        await page.waitForTimeout(3000);

        await page.getByRole('button', { name: 'Explorer' }).first().click();

        const hasAudio = await page
            .locator(
                'audio, button:has-text("Écouter"), [aria-label*="audio" i], [class*="audio" i]',
            )
            .first()
            .isVisible({ timeout: 5000 })
            .catch(() => false);
        expect(hasAudio).toBeTruthy();
    });

    test('should poll for audio when audioUrl is null', async ({ page }) => {
        await mockFullSanctuaire(page, { subscribed: true });

        let pollCount = 0;
        await page.route(`${BFF}/insights`, async (route) => {
            if (route.request().method() === 'GET') {
                pollCount++;
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        categories: [
                            {
                                category: 'SPIRITUEL',
                                metadata: {
                                    label: 'Spirituel',
                                    description: 'Éveil',
                                    icon: 'Sparkles',
                                    color: 'horizon',
                                },
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

        await page.goto(INSIGHTS_URL);
        await page.waitForTimeout(25000);

        expect(pollCount).toBeGreaterThan(1);
    });
});
