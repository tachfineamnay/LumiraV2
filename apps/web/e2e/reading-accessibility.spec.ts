import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoHorizontalOverflow } from './helpers/layout';

const PDF_BYTES = Buffer.from(
  'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAzMDAgMTQ0XSA+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAwNjQgMDAwMDAgbiAKMDAwMDAwMDEyMSAwMDAwMCBuIAp0cmFpbGVyCjw8IC9Sb290IDEgMCBSIC9TaXplIDQgPj4Kc3RhcnR4cmVmCjE5OQolJUVPRg==',
  'base64',
);

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'cache-control': 'no-store' },
    body: JSON.stringify(body),
  });
}

async function installReadingMocks(page: Page) {
  await page.route('**/api/auth/sanctuaire/session', (route) =>
    json(route, { authenticated: true }),
  );

  await page.route('**/api/bff/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/bff', '');

    if (request.method() === 'GET' && path === '/users/profile') {
      await json(route, {
        id: 'reader-a11y',
        email: 'reader.a11y@lumira.test',
        firstName: 'Ariane',
        lastName: 'Lecture',
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
      await json(route, [
        {
          id: 'order-a11y',
          orderNumber: 'LUM-A11Y',
          status: 'PAID',
          deliveredAt: '2026-07-28T10:00:00.000Z',
          createdAt: '2026-07-28T09:00:00.000Z',
          intakeRequired: true,
          intakeStatus: 'SEALED',
          intakeSealedAt: '2026-07-28T09:30:00.000Z',
        },
      ]);
      return;
    }

    if (request.method() === 'GET' && path === '/users/reading-amendments') {
      await json(route, []);
      return;
    }

    if (request.method() === 'GET' && path === '/client/readings') {
      await json(route, {
        pending: [],
        readings: [
          {
            id: 'reading-a11y',
            orderNumber: 'LUM-A11Y',
            status: 'COMPLETED',
            deliveredAt: '2026-07-28T10:00:00.000Z',
            createdAt: '2026-07-28T09:00:00.000Z',
            title: 'Lecture accessible',
            assets: { pdf: '/api/readings/LUM-A11Y/file', audio: null },
          },
        ],
      });
      return;
    }

    if (request.method() === 'GET' && path === '/readings/LUM-A11Y/file') {
      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        headers: { 'cache-control': 'no-store' },
        body: PDF_BYTES,
      });
      return;
    }

    await json(route, {});
  });
}

test('exposes PDF status, page image and native alternatives to assistive technology', async ({
  page,
}) => {
  await installReadingMocks(page);
  await page.goto('/sanctuaire/lecture/LUM-A11Y');

  const viewer = page.getByRole('region', { name: 'Lecteur PDF — Lecture accessible' });
  await expect(viewer).toBeVisible({ timeout: 60_000 });
  const pageImage = viewer.getByRole('img', { name: 'Page 1 sur 1 de Lecture accessible' });
  const pageStatus = viewer.getByTestId('reading-pdf-page-count');
  await expect(pageImage).toBeVisible({ timeout: 20_000 });
  await expect(pageImage).toHaveAttribute('aria-describedby', /.+/);
  await expect(pageStatus).toContainText('Page 1 sur 1');
  await expect(viewer.getByRole('button', { name: 'Télécharger' })).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Ouvrir dans un nouvel onglet' })).toBeVisible();

  await viewer.getByRole('button', { name: 'Zoom avant' }).click();
  await expect(pageStatus).toContainText('zoom 115 %');
  await expectNoHorizontalOverflow(page);
});
