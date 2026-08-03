import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoHorizontalOverflow } from './helpers/layout';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'cache-control': 'no-store' },
    body: JSON.stringify(body),
  });
}

async function installChatMocks(page: Page) {
  const requestSummary = {
    id: 'request-keyboard',
    subject: 'Question longue pour vérifier le clavier mobile',
    status: 'WAITING_CLIENT',
    category: 'READING_CLARIFICATION',
    priority: 'NORMAL',
    assignedExpert: { id: 'expert-1', name: 'Élise' },
    relatedReading: { id: 'reading-1', orderNumber: 'LUM-CHAT' },
    unreadCount: 1,
    messageCount: 2,
    lastSender: 'EXPERT',
    lastMessageAt: '2026-08-02T10:00:00.000Z',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-02T10:00:00.000Z',
  };

  await page.route('**/api/auth/sanctuaire/session', (route) =>
    json(route, { authenticated: true }),
  );

  await page.route('**/api/bff/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/bff', '');

    if (request.method() === 'GET' && path === '/users/profile') {
      await json(route, {
        id: 'chat-client',
        email: 'chat.client@lumira.test',
        firstName: 'Ariane',
        lastName: 'Chat',
        phone: null,
        profile: { profileCompleted: true, submittedAt: '2026-07-28T10:00:00.000Z' },
        stats: { totalOrders: 1, completedOrders: 1 },
      });
      return;
    }

    if (request.method() === 'GET' && path === '/users/entitlements') {
      await json(route, {
        capabilities: ['reading'],
        products: ['integrale'],
        highestLevel: 4,
        levelMetadata: { level: 4, name: 'Intégral', productId: 'integrale' },
        orderCount: 1,
      });
      return;
    }

    if (request.method() === 'GET' && path === '/users/orders/completed') {
      await json(route, []);
      return;
    }

    if (request.method() === 'GET' && path === '/users/reading-amendments') {
      await json(route, []);
      return;
    }

    if (request.method() === 'GET' && path === '/client/readings') {
      await json(route, {
        readings: [{ id: 'reading-1', orderNumber: 'LUM-CHAT', title: 'Lecture chat' }],
      });
      return;
    }

    if (request.method() === 'GET' && path === '/client/requests') {
      await json(route, { data: [requestSummary] });
      return;
    }

    if (request.method() === 'GET' && path === '/client/requests/request-keyboard') {
      await json(route, {
        ...requestSummary,
        messages: [
          {
            id: 'message-client',
            senderType: 'CLIENT',
            content:
              'Voici une adresse volontairement longue https://example.test/une-adresse/tres/longue/sans/coupure/pour/verifier-le-retour-a-la-ligne',
            createdAt: '2026-08-01T10:00:00.000Z',
          },
          {
            id: 'message-expert',
            senderType: 'EXPERT',
            senderName: 'Élise',
            content: 'Pouvez-vous préciser ce point avant que nous poursuivions ?',
            createdAt: '2026-08-02T10:00:00.000Z',
          },
        ],
      });
      return;
    }

    if (request.method() === 'POST' && path === '/client/requests/request-keyboard/read') {
      await json(route, {});
      return;
    }

    await json(route, {});
  });
}

test('keeps reply field and send action visible when the mobile viewport shrinks', async ({
  page,
}) => {
  await installChatMocks(page);
  await page.goto('/sanctuaire/chat');
  await page
    .getByRole('button', { name: /Question longue pour vérifier le clavier mobile/i })
    .click();

  const reply = page.getByLabel('Ajouter un message');
  await expect(reply).toBeVisible();
  await reply.focus();
  await reply.fill('Une précision conservée pendant que le clavier est ouvert.');

  const viewport = page.viewportSize();
  if (viewport && viewport.width < 1024) {
    await page.setViewportSize({ width: viewport.width, height: Math.min(viewport.height, 360) });
  }

  const send = page.getByRole('button', { name: 'Envoyer mon message à l’équipe' });
  await expect(reply).toBeVisible();
  await expect(send).toBeVisible();
  const [replyBox, sendBox, currentViewport] = await Promise.all([
    reply.boundingBox(),
    send.boundingBox(),
    Promise.resolve(page.viewportSize()),
  ]);
  expect(replyBox).not.toBeNull();
  expect(sendBox).not.toBeNull();
  expect(currentViewport).not.toBeNull();
  expect(replyBox!.y + replyBox!.height).toBeLessThanOrEqual(currentViewport!.height + 1);
  expect(sendBox!.y + sendBox!.height).toBeLessThanOrEqual(currentViewport!.height + 1);
  await expectNoHorizontalOverflow(page);
});
