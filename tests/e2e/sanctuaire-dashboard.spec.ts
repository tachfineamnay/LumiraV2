/**
 * E2E — Sanctuaire home state machine.
 * Every visible status comes from profile/order/onboarding responses.
 */
import { test, expect } from '@playwright/test';
import { mockFullSanctuaire, mockSanctuaireAuth } from '../helpers/api-mock';

test.describe('Sanctuaire — accueil', () => {
  test('shows the lifetime-access shell and a validated reading', async ({ page }) => {
    await mockFullSanctuaire(page, { profileCompleted: true, orderStatus: 'COMPLETED' });

    await page.goto('/sanctuaire');

    await expect(page.getByText('Accès à vie', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Votre lecture est prête' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mes lectures' }).first()).toBeVisible();
    await expect(page.getByText(/abonnement|voir les offres|initié/i)).toHaveCount(0);
  });

  test('starts the preparation only when the server profile is incomplete', async ({ page }) => {
    await mockSanctuaireAuth(page, { profileCompleted: false, hasOrders: true });

    await page.goto('/sanctuaire');

    await expect(
      page.getByRole('heading', { name: 'Préparez votre première lecture' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Préparer ma lecture' })).toBeVisible();
    await expect(page.getByText('Votre lecture est en préparation')).toHaveCount(0);
  });

  test('resumes a server-saved preparation draft', async ({ page }) => {
    await mockSanctuaireAuth(page, {
      profileCompleted: false,
      onboardingProgress: { currentStep: 1, status: 'IN_PROGRESS', data: { birthPlace: 'Lyon' } },
    });

    await page.goto('/sanctuaire');

    await expect(
      page.getByRole('heading', { name: 'Votre préparation vous attend' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reprendre ma préparation' })).toBeVisible();
  });

  test('validates the short preparation without persisting browser previews', async ({ page }) => {
    await mockSanctuaireAuth(page, { profileCompleted: false });

    await page.goto('/sanctuaire');
    await page.getByRole('button', { name: 'Préparer ma lecture' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.locator('#birth-date').fill('1990-06-15');
    await page.locator('#birth-place').fill('Lyon, France');
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.getByRole('button', { name: 'Continuer' }).click();
    await expect(page.getByRole('heading', { name: 'Vérifiez vos éléments' })).toBeVisible();

    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Valider et lancer la préparation' }).click();
    await expect(page.getByRole('heading', { name: 'Tout est bien reçu' })).toBeVisible();
  });

  test('uses the server order status for preparation and review states', async ({ page }) => {
    await mockSanctuaireAuth(page, { profileCompleted: true, orderStatus: 'PAID' });
    await page.goto('/sanctuaire');
    await expect(
      page.getByRole('heading', { name: 'Votre lecture est en préparation' }),
    ).toBeVisible();
    await expect(
      page.getByText('Vous n’avez plus rien à faire. Nous vous écrirons dès qu’elle sera prête.'),
    ).toBeVisible();

    await mockSanctuaireAuth(page, { profileCompleted: true, orderStatus: 'AWAITING_VALIDATION' });
    await page.goto('/sanctuaire');
    await expect(
      page.getByRole('heading', { name: 'Votre lecture est en vérification' }),
    ).toBeVisible();
  });
});
