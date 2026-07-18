/**
 * E2E — Sanctuaire home and client-controlled intake state machine.
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

  test('lets an incomplete client choose the base of their reading', async ({ page }) => {
    await mockSanctuaireAuth(page, { profileCompleted: false, hasOrders: true });

    await page.goto('/sanctuaire');

    await expect(
      page.getByRole('heading', { name: 'Choisissez la base de votre lecture' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Préparer mon dossier' })).toBeVisible();
    await expect(page.getByText('Votre dossier a bien été transmis')).toHaveCount(0);
  });

  test('resumes a server-saved client dossier', async ({ page }) => {
    await mockSanctuaireAuth(page, {
      profileCompleted: false,
      onboardingProgress: { currentStep: 2, status: 'IN_PROGRESS', data: { birthPlace: 'Lyon' } },
    });

    await page.goto('/sanctuaire');

    await expect(page.getByRole('heading', { name: 'Votre dossier vous attend' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reprendre mon dossier' })).toBeVisible();
  });

  test('supports review, change and explicit sealing before submission', async ({ page }) => {
    await mockSanctuaireAuth(page, { profileCompleted: false });

    await page.goto('/sanctuaire');
    await page.getByRole('button', { name: 'Préparer mon dossier' }).click();

    await expect(page.getByRole('heading', { name: 'Vous gardez la main' })).toBeVisible();
    await page.getByRole('button', { name: 'Commencer mon dossier' }).click();

    await page.getByLabel('Date de naissance').fill('1990-06-15');
    await page.getByLabel('Lieu de naissance').fill('Lyon, France');
    await page.getByRole('button', { name: 'Continuer' }).click();

    await expect(page.getByRole('heading', { name: 'Ce que vous souhaitez éclairer' })).toBeVisible();
    await page.getByLabel(/Votre question/).fill('Que dois-je comprendre maintenant ?');
    await page.getByRole('button', { name: 'Continuer' }).click();

    await expect(page.getByRole('heading', { name: 'Visage et paume' })).toBeVisible();
    await page.getByRole('button', { name: 'Continuer' }).click();

    await expect(page.getByRole('heading', { name: 'Votre contexte personnel' })).toBeVisible();
    await page.getByRole('button', { name: 'Continuer' }).click();

    await expect(page.getByRole('heading', { name: 'Relire et sceller' })).toBeVisible();
    await expect(page.getByText('Que dois-je comprendre maintenant ?')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Modifier' }).first()).toBeVisible();

    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Sceller et transmettre mon dossier' }).click();
    await expect(
      page.getByRole('heading', { name: 'Votre lecture de base peut commencer' }),
    ).toBeVisible();
  });

  test('uses the server order status after the dossier is sealed', async ({ page }) => {
    await mockSanctuaireAuth(page, { profileCompleted: true, orderStatus: 'PAID' });
    await page.goto('/sanctuaire');
    await expect(
      page.getByRole('heading', { name: 'Votre dossier a bien été transmis' }),
    ).toBeVisible();
    await expect(
      page.getByText(/Les éléments que vous avez choisis sont maintenant utilisés/),
    ).toBeVisible();

    await mockSanctuaireAuth(page, { profileCompleted: true, orderStatus: 'AWAITING_VALIDATION' });
    await page.goto('/sanctuaire');
    await expect(
      page.getByRole('heading', { name: 'Votre lecture est en vérification' }),
    ).toBeVisible();
  });
});
