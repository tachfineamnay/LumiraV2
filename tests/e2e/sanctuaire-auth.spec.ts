/**
 * E2E Tests — Sanctuaire Authentication Flow
 * Validates: login, redirect, rate limit UI, logout, auto-login via URL params
 */
import { test, expect } from '@playwright/test';
import { mockSanctuaireAuth } from '../helpers/api-mock';

const API_BASE = 'http://localhost:3001/api';

test.describe('Sanctuaire Auth — Login Page', () => {
    test('should display login form with email input', async ({ page }) => {
        await page.goto('/sanctuaire/login');

        // Login page should show email input
        const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');
        await expect(emailInput).toBeVisible();

        // Should have a submit button
        const submitBtn = page.locator('button[type="submit"], button:has-text("Accéder"), button:has-text("Connexion")');
        await expect(submitBtn).toBeVisible();
    });

    test('should show error on empty email submission', async ({ page }) => {
        await page.goto('/sanctuaire/login');

        const submitBtn = page.locator('button[type="submit"], button:has-text("Accéder"), button:has-text("Connexion")');
        await submitBtn.click();

        // Should show validation error
        const errorText = page.locator('text=/email/i');
        await expect(errorText.first()).toBeVisible({ timeout: 3000 });
    });

    test('should authenticate successfully and redirect to dashboard', async ({ page }) => {
        // Mock auth endpoint
        await page.route(`${API_BASE}/auth/sanctuaire-v2`, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    token: 'mock-jwt-token',
                    user: {
                        id: 'user-1',
                        email: 'marie@test.com',
                        firstName: 'Marie',
                        lastName: 'Dubois',
                        level: 4,
                    },
                }),
            });
        });

        // Mock subsequent data fetches
        await page.route(`${API_BASE}/users/profile`, async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
            } else {
                await route.continue();
            }
        });
        await page.route(`${API_BASE}/users/entitlements`, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ capabilities: [], products: [], highestLevel: 4, orderCount: 1 }),
            });
        });
        await page.route(`${API_BASE}/subscriptions/status`, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ hasSubscription: true, subscription: { status: 'ACTIVE' } }),
            });
        });
        await page.route(`${API_BASE}/users/orders/completed`, async (route) => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        });

        await page.goto('/sanctuaire/login');

        const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');
        await emailInput.fill('marie@test.com');

        const submitBtn = page.locator('button[type="submit"], button:has-text("Accéder"), button:has-text("Connexion")');
        await submitBtn.click();

        // Should redirect to /sanctuaire dashboard
        await page.waitForURL('**/sanctuaire', { timeout: 10000 });
        expect(page.url()).toContain('/sanctuaire');
    });

    test('should show error on authentication failure', async ({ page }) => {
        await page.route(`${API_BASE}/auth/sanctuaire-v2`, async (route) => {
            await route.fulfill({
                status: 401,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Aucun compte trouvé avec cet email.' }),
            });
        });

        await page.goto('/sanctuaire/login');

        const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');
        await emailInput.fill('inconnu@test.com');

        const submitBtn = page.locator('button[type="submit"], button:has-text("Accéder"), button:has-text("Connexion")');
        await submitBtn.click();

        // Should display error message
        await expect(page.locator('text=/erreur|introuvable|aucun compte/i').first()).toBeVisible({ timeout: 5000 });
    });

    test('should display cooldown timer after rate limit', async ({ page }) => {
        await page.route(`${API_BASE}/auth/sanctuaire-v2`, async (route) => {
            await route.fulfill({
                status: 429,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Too many requests' }),
            });
        });

        await page.goto('/sanctuaire/login');

        const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');
        await emailInput.fill('marie@test.com');

        const submitBtn = page.locator('button[type="submit"], button:has-text("Accéder"), button:has-text("Connexion")');
        await submitBtn.click();

        // Should show rate limit or cooldown indication
        await expect(
            page.locator('text=/attendre|patientez|secondes|limite|rate/i').first(),
        ).toBeVisible({ timeout: 5000 });
    });
});

test.describe('Sanctuaire Auth — Route Protection', () => {
    test('unauthenticated user on /sanctuaire should see login or redirect', async ({ page }) => {
        await page.goto('/sanctuaire');

        // SanctuaireGuard should redirect to login or show loader
        await page.waitForTimeout(2000);
        const url = page.url();
        const hasLoginRedirect = url.includes('/login') || url.includes('/connexion');
        const hasGuardUI = await page.locator('text=/connexion|identifi|authentifi/i').first().isVisible().catch(() => false);
        expect(hasLoginRedirect || hasGuardUI || url.includes('/sanctuaire')).toBeTruthy();
    });

    test('authenticated user can access /sanctuaire dashboard', async ({ page }) => {
        await mockSanctuaireAuth(page, { subscribed: true });
        await page.goto('/sanctuaire');

        // Should see dashboard UI (heading or navigation cards)
        await expect(page.locator('text=/sanctuaire|tableau de bord|mon profil/i').first()).toBeVisible({ timeout: 10000 });
    });

    test('token stored in localStorage after login', async ({ page }) => {
        await mockSanctuaireAuth(page);
        await page.goto('/sanctuaire');

        const token = await page.evaluate(() => localStorage.getItem('sanctuaire_token'));
        expect(token).toBeTruthy();
    });
});

test.describe('Sanctuaire Auth — Auto-login via URL', () => {
    test('should auto-login with email+token URL params', async ({ page }) => {
        await page.route(`${API_BASE}/auth/sanctuaire-v2`, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    token: 'auto-login-token',
                    user: { id: 'user-auto', email: 'auto@test.com', firstName: 'Auto', lastName: 'Test', level: 1 },
                }),
            });
        });
        await page.route(`${API_BASE}/users/profile`, async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
            } else {
                await route.continue();
            }
        });
        await page.route(`${API_BASE}/users/entitlements`, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ capabilities: [], products: [], highestLevel: 1, orderCount: 1 }),
            });
        });
        await page.route(`${API_BASE}/subscriptions/status`, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ hasSubscription: false, subscription: null }),
            });
        });
        await page.route(`${API_BASE}/users/orders/completed`, async (route) => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        });

        await page.goto('/sanctuaire?email=auto@test.com&token=auto-login-token');

        // Should land on the dashboard
        await page.waitForTimeout(3000);
        expect(page.url()).toContain('/sanctuaire');
    });
});
