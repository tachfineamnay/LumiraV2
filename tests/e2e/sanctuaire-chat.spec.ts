/** E2E — client guidance requests are exchanged with the human Desk inbox. */
import { test, expect, type Page } from '@playwright/test';
import { mockSanctuaireAuth } from '../helpers/api-mock';

const baseRequest = {
  id: 'request-1',
  subject: 'Comprendre ma mission',
  status: 'WAITING_CLIENT',
  category: 'READING_CLARIFICATION',
  priority: 'NORMAL',
  assignedExpert: { id: 'expert-1', name: 'Grégory' },
  relatedReading: { id: 'order-1', orderNumber: 'LUM-001' },
  unreadCount: 1,
  messageCount: 2,
  lastSender: 'EXPERT',
  lastMessageAt: '2026-07-17T09:05:00.000Z',
  createdAt: '2026-07-17T09:00:00.000Z',
  updatedAt: '2026-07-17T09:05:00.000Z',
  messages: [
    {
      id: 'message-1',
      senderType: 'CLIENT',
      senderName: null,
      content: 'Je souhaite mieux comprendre le passage sur ma mission.',
      createdAt: '2026-07-17T09:00:00.000Z',
    },
    {
      id: 'message-2',
      senderType: 'EXPERT',
      senderName: 'Grégory',
      content: 'Relisez ce passage en le reliant à la décision que vous traversez actuellement.',
      createdAt: '2026-07-17T09:05:00.000Z',
    },
  ],
};

async function mockGuidanceApi(page: Page) {
  let currentRequest = structuredClone(baseRequest);

  await page.route('**/api/bff/client/readings', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        readings: [{ id: 'order-1', orderNumber: 'LUM-001', title: "Lecture d'Âme" }],
        pending: [],
      }),
    });
  });

  await page.route('**/api/bff/client/requests**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (request.method() === 'GET' && path.endsWith('/client/requests')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ ...currentRequest, messages: undefined }] }),
      });
      return;
    }

    if (request.method() === 'GET' && path.endsWith('/client/requests/request-1')) {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(currentRequest) });
      return;
    }

    if (request.method() === 'POST' && path.endsWith('/client/requests/request-1/read')) {
      currentRequest = { ...currentRequest, unreadCount: 0 };
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true, request: currentRequest }),
      });
      return;
    }

    if (request.method() === 'POST' && path.endsWith('/client/requests/request-1/messages')) {
      const body = request.postDataJSON() as { content: string };
      currentRequest = {
        ...currentRequest,
        status: 'WAITING_EXPERT',
        lastSender: 'CLIENT',
        lastMessageAt: '2026-07-17T09:10:00.000Z',
        messageCount: currentRequest.messageCount + 1,
        messages: [
          ...currentRequest.messages,
          {
            id: 'message-3',
            senderType: 'CLIENT',
            senderName: null,
            content: body.content,
            createdAt: '2026-07-17T09:10:00.000Z',
          },
        ],
      } as typeof currentRequest;
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(currentRequest) });
      return;
    }

    if (request.method() === 'POST' && path.endsWith('/client/requests')) {
      const body = request.postDataJSON() as {
        subject: string;
        content: string;
        category: string;
      };
      const created = {
        ...baseRequest,
        id: 'request-2',
        subject: body.subject,
        category: body.category,
        status: 'NEW',
        assignedExpert: null,
        relatedReading: null,
        unreadCount: 0,
        messageCount: 1,
        lastSender: 'CLIENT',
        messages: [
          {
            id: 'message-created',
            senderType: 'CLIENT',
            senderName: null,
            content: body.content,
            createdAt: '2026-07-17T10:00:00.000Z',
          },
        ],
      };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(created) });
      return;
    }

    await route.fallback();
  });
}

test.describe('Sanctuaire — demander un éclairage', () => {
  test('restores a Desk request and sends a client follow-up', async ({ page }) => {
    await mockSanctuaireAuth(page);
    await mockGuidanceApi(page);

    await page.goto('/sanctuaire/chat');

    await expect(page.getByRole('heading', { name: 'Demander un éclairage' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Comprendre ma mission', { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText('Relisez ce passage en le reliant à la décision que vous traversez actuellement.'),
    ).toBeVisible();
    await expect(page.getByText(/réponse automatique/i)).toBeVisible();

    await page.getByLabel('Ajouter un message').fill('Merci, je vais relier ce passage à mon choix actuel.');
    await page.getByRole('button', { name: 'Envoyer mon message au Desk' }).click();

    await expect(page.getByText('Merci, je vais relier ce passage à mon choix actuel.')).toBeVisible();
    await expect(page.getByText(/en attente de réponse du Desk/i)).toBeVisible();
  });

  test('creates a new request linked to a reading', async ({ page }) => {
    await mockSanctuaireAuth(page);
    await mockGuidanceApi(page);

    await page.goto('/sanctuaire/chat');
    await page.getByRole('button', { name: 'Nouvelle demande' }).click();
    await page.getByLabel('Lecture concernée, facultatif').selectOption('order-1');
    await page.getByLabel('Sujet').fill('Clarifier un passage important');
    await page
      .getByLabel('Votre message')
      .fill('Je souhaite comprendre comment appliquer ce passage dans ma situation actuelle.');
    await page.getByRole('button', { name: 'Envoyer au Desk' }).click();

    await expect(page.getByText('Clarifier un passage important', { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText('Je souhaite comprendre comment appliquer ce passage dans ma situation actuelle.'),
    ).toBeVisible();
  });

  test('does not present subscription or quota language', async ({ page }) => {
    await mockSanctuaireAuth(page);
    await mockGuidanceApi(page);
    await page.goto('/sanctuaire/chat');

    await expect(page.getByText(/abonnement|premium|messages restants|illimité|quota/i)).toHaveCount(0);
  });
});
