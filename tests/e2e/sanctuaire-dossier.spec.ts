import { test, expect } from '@playwright/test';
import { mockSanctuaireAuth } from '../helpers/api-mock';

test.describe('Sanctuaire — mon dossier', () => {
  test('shows an editable private draft before sealing', async ({ page }) => {
    await mockSanctuaireAuth(page, {
      profileCompleted: false,
      onboardingProgress: {
        currentStep: 2,
        status: 'IN_PROGRESS',
        data: {
          birthDate: '1990-06-15',
          birthPlace: 'Lyon, France',
          specificQuestion: 'Que dois-je comprendre maintenant ?',
        },
      },
    });

    await page.goto('/sanctuaire/dossier');

    await expect(page.getByRole('heading', { name: 'Mon dossier de lecture' })).toBeVisible();
    await expect(page.getByText('Brouillon privé')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reprendre et modifier' })).toBeVisible();
    await expect(page.getByText('Que dois-je comprendre maintenant ?')).toBeVisible();
  });

  test('shows a protected sealed dossier during production', async ({ page }) => {
    await mockSanctuaireAuth(page, {
      profileCompleted: true,
      orderStatus: 'PROCESSING',
    });

    await page.goto('/sanctuaire/dossier');

    await expect(page.getByText('Dossier scellé')).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'Les éléments transmis sont protégés pendant la production',
      }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /modifier/i })).toHaveCount(0);
  });

  test('keeps the historical reading snapshot separate after delivery', async ({ page }) => {
    await mockSanctuaireAuth(page, {
      profileCompleted: true,
      orderStatus: 'COMPLETED',
    });

    await page.goto('/sanctuaire/dossier');

    await expect(page.getByText('Dossier scellé')).toBeVisible();
    await expect(page.getByText(/ne modifieront pas cette lecture/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Gérer mon profil' })).toBeVisible();
  });
});
