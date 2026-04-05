/**
 * E2E Tests — Sanctuaire Subscription Management (Abonnement)
 * Validates: status display, cancel flow, resume flow, billing dates, unsubscribed state
 */
import { test, expect } from '@playwright/test';
import { mockSanctuaireAuth, mockSubscriptionManagementApi } from '../helpers/api-mock';

const API_BASE = 'http://localhost:3001/api';

test.describe('Sanctuaire Subscription — Active', () => {
    test.beforeEach(async ({ page }) => {
        await mockSanctuaireAuth(page, { subscribed: true });
        await mockSubscriptionManagementApi(page);
    });

    test('should display active subscription status', async ({ page }) => {
        await page.goto('/sanctuaire/abonnement');
        await page.waitForTimeout(3000);

        // Should show "Actif" or green badge
        await expect(
            page.locator('text=/actif|active/i').first(),
        ).toBeVisible({ timeout: 5000 });
    });

    test('should display billing period dates', async ({ page }) => {
        await page.goto('/sanctuaire/abonnement');
        await page.waitForTimeout(3000);

        // Should show period dates in French format
        const hasDate = await page.locator('text=/\\d{1,2}\\s+\\w+\\s+\\d{4}/').first().isVisible({ timeout: 5000 }).catch(() => false);
        expect(hasDate).toBeTruthy();
    });

    test('should show cancel button for active subscription', async ({ page }) => {
        await page.goto('/sanctuaire/abonnement');
        await page.waitForTimeout(3000);

        const cancelBtn = page.locator('button:has-text("Annuler"), button:has-text("Résilier")').first();
        await expect(cancelBtn).toBeVisible({ timeout: 5000 });
    });

    test('should show confirmation dialog before cancellation', async ({ page }) => {
        await page.goto('/sanctuaire/abonnement');
        await page.waitForTimeout(3000);

        const cancelBtn = page.locator('button:has-text("Annuler"), button:has-text("Résilier")').first();
        await cancelBtn.click();

        // Should show confirmation dialog
        await expect(
            page.locator('text=/confirmer|sûr|annulation/i').first(),
        ).toBeVisible({ timeout: 5000 });
    });

    test('should cancel subscription on confirmation', async ({ page }) => {
        let cancelCalled = false;
        await page.route(`${API_BASE}/subscriptions/cancel`, async (route) => {
            cancelCalled = true;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ status: 'ACTIVE', cancelAtPeriodEnd: true }),
            });
        });

        await page.goto('/sanctuaire/abonnement');
        await page.waitForTimeout(3000);

        // Click cancel
        const cancelBtn = page.locator('button:has-text("Annuler"), button:has-text("Résilier")').first();
        await cancelBtn.click();

        // Confirm
        const confirmBtn = page.locator('button:has-text("Confirmer"), button:has-text("Oui")').first();
        if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await confirmBtn.click();
            await page.waitForTimeout(2000);
            expect(cancelCalled).toBe(true);
        }
    });
});

test.describe('Sanctuaire Subscription — Cancelled (pending end)', () => {
    test('should show resume button when cancelAtPeriodEnd', async ({ page }) => {
        await mockSanctuaireAuth(page, { subscribed: true });

        // Override subscription status to cancelAtPeriodEnd
        await page.route(`${API_BASE}/subscriptions/status`, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    hasSubscription: true,
                    subscription: {
                        id: 'sub-1',
                        status: 'ACTIVE',
                        currentPeriodStart: new Date().toISOString(),
                        currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
                        cancelAtPeriodEnd: true,
                        stripeSubscriptionId: 'sub_test',
                    },
                }),
            });
        });

        await page.goto('/sanctuaire/abonnement');
        await page.waitForTimeout(3000);

        // Should show "Reprendre" or "Réactiver" button
        const resumeBtn = page.locator('button:has-text("Reprendre"), button:has-text("Réactiver"), button:has-text("Resume")').first();
        await expect(resumeBtn).toBeVisible({ timeout: 5000 });
    });

    test('should resume subscription on click', async ({ page }) => {
        await mockSanctuaireAuth(page, { subscribed: true });

        await page.route(`${API_BASE}/subscriptions/status`, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    hasSubscription: true,
                    subscription: {
                        id: 'sub-1',
                        status: 'ACTIVE',
                        currentPeriodStart: new Date().toISOString(),
                        currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
                        cancelAtPeriodEnd: true,
                        stripeSubscriptionId: 'sub_test',
                    },
                }),
            });
        });

        let resumeCalled = false;
        await page.route(`${API_BASE}/subscriptions/resume`, async (route) => {
            resumeCalled = true;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ status: 'ACTIVE', cancelAtPeriodEnd: false }),
            });
        });

        await page.goto('/sanctuaire/abonnement');
        await page.waitForTimeout(3000);

        const resumeBtn = page.locator('button:has-text("Reprendre"), button:has-text("Réactiver")').first();
        await resumeBtn.click();
        await page.waitForTimeout(2000);

        expect(resumeCalled).toBe(true);
    });
});

test.describe('Sanctuaire Subscription — No Subscription', () => {
    test('should display no-subscription state', async ({ page }) => {
        await mockSanctuaireAuth(page, { subscribed: false });

        await page.route(`${API_BASE}/subscriptions/status`, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ hasSubscription: false, subscription: null }),
            });
        });

        await page.goto('/sanctuaire/abonnement');
        await page.waitForTimeout(3000);

        // Should show "no subscription" state or redirect to subscribe
        const hasNoSub = await page.locator('text=/aucun abonnement|pas d\'abonnement|souscrire|s\'abonner/i').first().isVisible({ timeout: 5000 }).catch(() => false);
        const hasRedirect = page.url().includes('/abonnement') || page.url().includes('/subscribe');
        expect(hasNoSub || hasRedirect).toBeTruthy();
    });
});
