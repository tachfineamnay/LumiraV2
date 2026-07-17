/**
 * E2E — Sanctuaire mobile shell (Pixel 5 / Chromium)
 * Validates: bottom nav, no horizontal overflow, chat chrome, profile → réglages
 */
import { test, expect, type Page } from '@playwright/test';
import { mockFullSanctuaire, mockChatApi } from '../helpers/api-mock';

async function assertNoHorizontalOverflow(page: Page) {
    const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return Math.max(doc.scrollWidth, document.body.scrollWidth) - window.innerWidth;
    });
    expect(overflow).toBeLessThanOrEqual(2);
}

async function waitForSanctuaireShell(page: Page) {
    await expect(page.getByRole('navigation', { name: /navigation principale/i })).toBeVisible({
        timeout: 20000,
    });
}

test.describe('Sanctuaire Mobile — Shell', () => {
    test.beforeEach(async ({ page }) => {
        await mockFullSanctuaire(page, { subscribed: true, profileCompleted: true });
    });

    test('should show bottom nav and clear primary routes', async ({ page }) => {
        await page.goto('/sanctuaire');
        await waitForSanctuaireShell(page);

        const nav = page.getByRole('navigation', { name: /navigation principale/i });
        await expect(nav.locator('a[href="/sanctuaire"]').first()).toBeVisible();
        await expect(nav.locator('a[href="/sanctuaire/draws"]').first()).toBeVisible();
        await expect(nav.locator('a[href="/sanctuaire/path"]').first()).toBeVisible();
        await expect(nav.locator('a[href="/sanctuaire/chat"]').first()).toBeVisible();

        await assertNoHorizontalOverflow(page);
    });

    test('should keep mandala labels without horizontal overflow', async ({ page }) => {
        await page.goto('/sanctuaire');
        await waitForSanctuaireShell(page);

        // Prefer visible mobile bottom-nav labels (desktop sidebar stays in DOM but hidden).
        const mobileNav = page.getByRole('navigation', { name: /navigation principale/i });
        await expect(mobileNav.getByText('Lectures')).toBeVisible({ timeout: 10000 });
        await expect(mobileNav.getByText('Chemin')).toBeVisible();
        await assertNoHorizontalOverflow(page);
    });

    test('should keep Oracle FAB above bottom nav on path', async ({ page }) => {
        await page.goto('/sanctuaire/path');
        await waitForSanctuaireShell(page);

        const fab = page.getByRole('button', { name: /parler à l'oracle/i });
        const bottomNav = page.getByRole('navigation', { name: /navigation principale/i });

        await expect(fab).toBeVisible({ timeout: 15000 });
        const fabBox = await fab.boundingBox();
        const navBox = await bottomNav.boundingBox();
        expect(fabBox).toBeTruthy();
        expect(navBox).toBeTruthy();
        if (fabBox && navBox) {
            expect(fabBox.y + fabBox.height).toBeLessThanOrEqual(navBox.y + 2);
        }

        await assertNoHorizontalOverflow(page);
    });
});

test.describe('Sanctuaire Mobile — Chat', () => {
    test('should keep chat input visible without page overflow', async ({ page }) => {
        await mockFullSanctuaire(page, { subscribed: true, profileCompleted: true });
        await mockChatApi(page, { subscribed: true });

        await page.goto('/sanctuaire/chat');
        await waitForSanctuaireShell(page);

        const input = page.locator('input[placeholder*="question"]').first();
        await expect(input).toBeVisible({ timeout: 15000 });

        const sendBtn = page.getByRole('button', { name: /envoyer le message/i });
        await expect(sendBtn).toBeVisible();

        const inputBox = await input.boundingBox();
        const navBox = await page
            .getByRole('navigation', { name: /navigation principale/i })
            .boundingBox();

        expect(inputBox).toBeTruthy();
        expect(navBox).toBeTruthy();
        if (inputBox && navBox) {
            expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(navBox.y + 8);
        }

        await assertNoHorizontalOverflow(page);
    });
});

test.describe('Sanctuaire Mobile — Profile settings link', () => {
    test('should open preferences from Réglages', async ({ page }) => {
        await mockFullSanctuaire(page, { subscribed: true, profileCompleted: true });

        await page.goto('/sanctuaire/profile');
        await waitForSanctuaireShell(page);

        const settingsLink = page.locator('a[href="/sanctuaire/settings/preferences"]').first();
        await expect(settingsLink).toBeVisible({ timeout: 15000 });
        await settingsLink.click();

        await page.waitForURL('**/sanctuaire/settings/preferences', { timeout: 10000 });
        await expect(page.getByRole('heading', { name: /réglages/i })).toBeVisible();
        await assertNoHorizontalOverflow(page);
    });
});
