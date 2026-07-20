/** E2E — client guidance requests are exchanged with the human Desk inbox. */
import { test, expect } from '@playwright/test';
import { mockGuidanceRequestsApi, mockSanctuaireAuth } from '../helpers/api-mock';

test.describe('Sanctuaire — demander un éclairage', () => {
  test('restores a Desk request and sends a client follow-up', async ({ page }) => {
    await mockSanctuaireAuth(page);
    await mockGuidanceRequestsApi(page);

    await page.goto('/sanctuaire/chat');

    await expect(page.getByRole('heading', { name: 'Demander un éclairage' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Comprendre ma mission', { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText(
        'Relisez ce passage en le reliant à la décision que vous traversez actuellement.',
      ),
    ).toBeVisible();
    await expect(page.getByText(/réponse automatique/i)).toBeVisible();

    await page
      .getByLabel('Ajouter un message')
      .fill('Merci, je vais relier ce passage à mon choix actuel.');
    await page.getByRole('button', { name: 'Envoyer mon message au Desk' }).click();

    await expect(
      page.getByText('Merci, je vais relier ce passage à mon choix actuel.'),
    ).toBeVisible();
    await expect(page.getByText(/en attente de réponse du Desk/i)).toBeVisible();
  });

  test('creates a new request linked to a reading', async ({ page }) => {
    await mockSanctuaireAuth(page);
    await mockGuidanceRequestsApi(page);

    await page.goto('/sanctuaire/chat');
    await page.getByRole('button', { name: 'Nouvelle demande' }).click();
    await page.getByLabel('Lecture concernée, facultatif').selectOption('order-1');
    await page.getByLabel('Sujet').fill('Clarifier un passage important');
    await page
      .getByLabel('Votre message')
      .fill('Je souhaite comprendre comment appliquer ce passage dans ma situation actuelle.');
    await page.getByRole('button', { name: 'Envoyer au Desk' }).click();

    await expect(
      page.getByText('Clarifier un passage important', { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Je souhaite comprendre comment appliquer ce passage dans ma situation actuelle.',
      ),
    ).toBeVisible();
  });

  test('does not present subscription or quota language', async ({ page }) => {
    await mockSanctuaireAuth(page);
    await mockGuidanceRequestsApi(page);

    await page.goto('/sanctuaire/chat');

    await expect(page.getByRole('heading', { name: 'Demander un éclairage' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/abonnement|quota|messages restants/i)).toHaveCount(0);
  });
});
