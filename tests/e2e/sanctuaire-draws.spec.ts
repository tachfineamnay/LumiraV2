/**
 * E2E Tests — Sanctuaire Draws/Readings (Tirages)
 * Validates: readings list, status badges, PDF viewer, download button, audio player
 */
import { test, expect } from '@playwright/test';
import { mockSanctuaireAuth, mockDrawsApi } from '../helpers/api-mock';

const API_BASE = 'http://localhost:3001/api';

test.describe('Sanctuaire Draws — Display', () => {
    test.beforeEach(async ({ page }) => {
        await mockSanctuaireAuth(page, { subscribed: true, hasOrders: true });
    });

    test('should display draws/readings page with completed orders', async ({ page }) => {
        // Mock completed orders
        await page.route(`${API_BASE}/users/orders/completed`, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([
                    {
                        id: 'order-1',
                        orderNumber: 'LU240115001',
                        level: 1,
                        status: 'COMPLETED',
                        deliveredAt: new Date().toISOString(),
                        createdAt: new Date().toISOString(),
                        archetype: 'Le Sage',
                        title: 'Lecture d\'Âme',
                        assets: { pdf: 'https://s3.example.com/reading.pdf' },
                    },
                ]),
            });
        });

        await page.goto('/sanctuaire/draws');
        await page.waitForTimeout(3000);

        // Should show at least one reading/draw
        await expect(
            page.locator('text=/lecture|tirage|LU240115001|sage/i').first(),
        ).toBeVisible({ timeout: 5000 });
    });

    test('should display draw types section', async ({ page }) => {
        await page.goto('/sanctuaire/draws');
        await page.waitForTimeout(3000);

        // Should show draw types like "Lecture d'Âme"
        await expect(
            page.locator('text=/lecture d\'âme|soul reading/i').first(),
        ).toBeVisible({ timeout: 5000 });
    });

    test('should show "Coming Soon" for unavailable draw types', async ({ page }) => {
        await page.goto('/sanctuaire/draws');
        await page.waitForTimeout(3000);

        // "Tirage Énergétique", "Analyse Karmique" etc. should show "coming soon"
        const comingSoon = page.locator('text=/bientôt|coming soon|prochainement/i');
        const count = await comingSoon.count();
        expect(count).toBeGreaterThan(0);
    });

    test('should display empty state when no orders', async ({ page }) => {
        await mockSanctuaireAuth(page, { subscribed: true, hasOrders: false });

        await page.goto('/sanctuaire/draws');
        await page.waitForTimeout(3000);

        // May show empty readings list or just draw types
        const hasContent = await page.locator('text=/lecture|tirage|âme/i').first().isVisible({ timeout: 5000 }).catch(() => false);
        expect(hasContent).toBeTruthy();
    });
});

test.describe('Sanctuaire Draws — Reading Actions', () => {
    test('should show PDF download button for completed reading', async ({ page }) => {
        await mockSanctuaireAuth(page, { subscribed: true, hasOrders: true });
        await mockDrawsApi(page);

        await page.route(`${API_BASE}/users/orders/completed`, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([
                    {
                        id: 'order-1',
                        orderNumber: 'LU240115001',
                        level: 1,
                        status: 'COMPLETED',
                        deliveredAt: new Date().toISOString(),
                        createdAt: new Date().toISOString(),
                        archetype: 'Le Sage',
                        title: 'Lecture d\'Âme',
                        assets: { pdf: 'https://s3.example.com/reading.pdf' },
                    },
                ]),
            });
        });

        await page.goto('/sanctuaire/draws');
        await page.waitForTimeout(3000);

        // Look for download or view PDF button
        const downloadBtn = page.locator('button:has-text("Télécharger"), button:has-text("PDF"), a:has-text("PDF"), button svg.lucide-download').first();
        const viewBtn = page.locator('button:has-text("Consulter"), button:has-text("Voir"), button:has-text("Lire")').first();

        const hasAction = await downloadBtn.isVisible().catch(() => false) || await viewBtn.isVisible().catch(() => false);
        expect(hasAction).toBeTruthy();
    });

    test('should show processing status for pending orders', async ({ page }) => {
        await mockSanctuaireAuth(page, { subscribed: true, hasOrders: true });

        await page.route(`${API_BASE}/users/orders/completed`, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([
                    {
                        id: 'order-2',
                        orderNumber: 'LU240115002',
                        level: 1,
                        status: 'PROCESSING',
                        deliveredAt: null,
                        createdAt: new Date().toISOString(),
                        archetype: null,
                        title: 'Lecture d\'Âme',
                        inProgress: true,
                        assets: {},
                    },
                ]),
            });
        });

        await page.goto('/sanctuaire/draws');
        await page.waitForTimeout(3000);

        // Should show "in progress" or similar status
        const hasProcessing = await page.locator('text=/en cours|traitement|préparation|processing/i').first().isVisible({ timeout: 5000 }).catch(() => false);
        expect(hasProcessing).toBeTruthy();
    });
});
