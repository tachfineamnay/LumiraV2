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

    await expect(page.getByText('Accès early · 3 mois', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Votre lecture est prête' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mes lectures' }).first()).toBeVisible();
    await expect(page.getByText(/abonnement|voir les offres|initié/i)).toHaveCount(0);
  });

  test('lets an incomplete client choose the base of their reading', async ({ page }) => {
    await mockSanctuaireAuth(page, { profileCompleted: false, hasOrders: true });

    await page.goto('/sanctuaire');

    await expect(
      page.getByRole('heading', { name: 'Préparez la base de votre lecture' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Vos repères essentiels' })).toBeVisible();
    await expect(page.getByText('Votre dossier a bien été reçu')).toHaveCount(0);
  });

  test('resumes a server-saved client dossier', async ({ page }) => {
    await mockSanctuaireAuth(page, {
      profileCompleted: false,
      onboardingProgress: { currentStep: 2, status: 'IN_PROGRESS', data: { birthPlace: 'Lyon' } },
    });

    await page.goto('/sanctuaire');

    await expect(
      page.getByRole('heading', { name: 'Votre brouillon est prêt à être repris' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reprendre mon dossier' })).toBeVisible();
  });

  test('keeps the intake review reachable before explicit sealing', async ({ page }) => {
    await mockSanctuaireAuth(page, { profileCompleted: false });

    await page.goto('/sanctuaire');
    await expect(page.getByRole('heading', { name: 'Vos repères essentiels' })).toBeVisible();

    await page.getByLabel('Date de naissance').fill('1990-06-15');
    await page.getByLabel('Lieu de naissance').fill('Lyon, France');
    await page.getByRole('button', { name: 'Continuer' }).click();

    await expect(page.getByRole('heading', { name: 'Ce qui vous amène' })).toBeVisible();
    await page
      .getByLabel(/éclairer une seule question/i)
      .fill('Que dois-je comprendre maintenant ?');
    await page.getByRole('button', { name: 'Continuer' }).click();

    await expect(page.getByRole('heading', { name: 'Vos photos privées' })).toBeVisible();
    await page.getByRole('button', { name: 'Continuer' }).click();

    await expect(page.getByRole('heading', { name: 'Relecture et transmission' })).toBeVisible();
    await expect(page.getByText('Que dois-je comprendre maintenant ?')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Modifier' }).first()).toBeVisible();
  });

  test('surfaces the server order status after the dossier is sealed', async ({ page }) => {
    await mockSanctuaireAuth(page, { profileCompleted: true, orderStatus: 'PAID' });
    await page.goto('/sanctuaire');
    await expect(
      page.getByRole('heading', { name: 'Votre dossier a bien été reçu' }),
    ).toBeVisible();
    await expect(page.getByText(/Vous n’avez plus rien à faire/)).toBeVisible();

    await mockSanctuaireAuth(page, { profileCompleted: true, orderStatus: 'AWAITING_VALIDATION' });
    await page.goto('/sanctuaire');
    await expect(
      page.getByRole('heading', { name: 'Votre lecture est relue par l’équipe' }),
    ).toBeVisible();
  });
});
