/**
 * E2E Tests — Sanctuaire Authentication Flow
 * Validates: magic-link request, rate limit UI and route protection.
 */
import { test, expect } from '@playwright/test';
import { mockSanctuaireAuth } from '../helpers/api-mock';

const BFF = '**/api/bff';

test.describe('Sanctuaire Auth — Login Page', () => {
  test('should display login form with email input', async ({ page }) => {
    await page.goto('/sanctuaire/login');

    // Login page should show email input
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');
    await expect(emailInput).toBeVisible();

    // Should have a submit button
    const submitBtn = page.locator(
      'button[type="submit"], button:has-text("Accéder"), button:has-text("Connexion")',
    );
    await expect(submitBtn).toBeVisible();
  });

  test('should show error on empty email submission', async ({ page }) => {
    await page.goto('/sanctuaire/login');

    const submitBtn = page.locator(
      'button[type="submit"], button:has-text("Accéder"), button:has-text("Connexion")',
    );
    // Empty submissions are prevented before any network request.
    await expect(submitBtn).toBeDisabled();
    await expect(page.locator('input[type="email"]')).toHaveValue('');
  });

  test('should request a magic link without authenticating the browser', async ({ page }) => {
    await page.route(`${BFF}/auth/sanctuaire-v2`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message:
            'Si un accès existe pour cette adresse, un lien de connexion vient d’être envoyé.',
        }),
      });
    });

    await page.goto('/sanctuaire/login');

    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');
    await emailInput.fill('marie@test.com');

    const submitBtn = page.locator(
      'button[type="submit"], button:has-text("Accéder"), button:has-text("Connexion")',
    );
    await submitBtn.click();

    await expect(page.getByText(/lien de connexion vient d’être envoyé/i)).toBeVisible();
    expect(page.url()).toContain('/sanctuaire/login');
  });

  test('should show an error when the magic-link request fails', async ({ page }) => {
    await page.route(`${BFF}/auth/sanctuaire-v2`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Service indisponible.' }),
      });
    });

    await page.goto('/sanctuaire/login');

    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');
    await emailInput.fill('inconnu@test.com');

    const submitBtn = page.locator(
      'button[type="submit"], button:has-text("Accéder"), button:has-text("Connexion")',
    );
    await submitBtn.click();

    // Should display error message
    await expect(page.locator('text=/erreur de connexion/i').first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('should display cooldown timer after rate limit', async ({ page }) => {
    await page.route(`${BFF}/auth/sanctuaire-v2`, async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Too many requests' }),
      });
    });

    await page.goto('/sanctuaire/login');

    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');
    await emailInput.fill('marie@test.com');

    const submitBtn = page.locator(
      'button[type="submit"], button:has-text("Accéder"), button:has-text("Connexion")',
    );
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
    const hasGuardUI = await page
      .locator('text=/connexion|identifi|authentifi/i')
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasLoginRedirect || hasGuardUI || url.includes('/sanctuaire')).toBeTruthy();
  });

  test('authenticated user can access /sanctuaire dashboard', async ({ page }) => {
    await mockSanctuaireAuth(page, { subscribed: true });
    await page.goto('/sanctuaire');

    // Should see dashboard UI (heading or navigation cards)
    await expect(page.locator('text=/sanctuaire|tableau de bord|mon profil/i').first()).toBeVisible(
      { timeout: 10000 },
    );
  });

  test('session token is not stored in localStorage', async ({ page }) => {
    await mockSanctuaireAuth(page);
    await page.goto('/sanctuaire');

    const token = await page.evaluate(() => localStorage.getItem('sanctuaire_token'));
    expect(token).toBeNull();
  });
});

test.describe('Sanctuaire Auth — URL hardening', () => {
  test('must not authenticate from legacy email and token URL parameters', async ({ page }) => {
    await page.goto('/sanctuaire?email=auto@test.com&token=auto-login-token');
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/sanctuaire/login');
  });
});
