/** E2E — a reading follow-up preserves history without subscription claims. */
import { test, expect } from '@playwright/test';
import { mockChatApi, mockSanctuaireAuth } from '../helpers/api-mock';

test.describe('Sanctuaire — demander un éclairage', () => {
  test('restores the latest conversation and sends a follow-up', async ({ page }) => {
    await mockSanctuaireAuth(page);
    await mockChatApi(page);
    await page.route('**/api/bff/client/chat/history', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          sessionId: 'session-history',
          messages: [
            {
              role: 'user',
              content: 'Que retenir de ma lecture ?',
              timestamp: '2026-07-17T09:00:00.000Z',
            },
            {
              role: 'assistant',
              content: 'Prenez le temps de relire les éléments importants.',
              timestamp: '2026-07-17T09:01:00.000Z',
            },
          ],
        }),
      });
    });

    await page.goto('/sanctuaire/chat');

    await expect(page.getByRole('heading', { name: 'Demander un éclairage' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Que retenir de ma lecture ?')).toBeVisible();
    await expect(
      page.getByText('Prenez le temps de relire les éléments importants.'),
    ).toBeVisible();

    await page.getByLabel('Votre question').fill('Comment relire ma synthèse ?');
    await page.getByRole('button', { name: 'Envoyer ma demande d’éclairage' }).click();

    await expect(page.getByText('Comment relire ma synthèse ?')).toBeVisible();
    await expect(
      page.getByText("Votre question touche à l'essence même de votre lecture."),
    ).toBeVisible();
  });

  test('does not present a subscription, quota, or unlimited-chat claim', async ({ page }) => {
    await mockSanctuaireAuth(page);
    await mockChatApi(page);

    await page.goto('/sanctuaire/chat');

    await expect(
      page.getByText(/abonnement|premium|messages restants|illimité|quota/i),
    ).toHaveCount(0);
  });
});
