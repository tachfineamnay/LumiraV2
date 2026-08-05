import { expect, type Page, type Route, test } from '@playwright/test';

type Amendment = {
  id: string;
  orderId: string;
  kind: 'PROFILE_FIELDS';
  requestedFields: string[];
  reason: string;
  status: 'REQUESTED' | 'DRAFT' | 'SUBMITTED';
  displayStatus: string;
  data: { values: Record<string, string>; photoFields: string[]; fieldLabels: string[] };
  revision: number;
  expiresAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  updatedAt: string;
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'cache-control': 'no-store' },
    body: JSON.stringify(body),
  });
}

async function installMocks(page: Page) {
  let amendment: Amendment = {
    id: 'ram-required-e2e',
    orderId: 'order-e2e',
    kind: 'PROFILE_FIELDS',
    requestedFields: ['birthPlace', 'specificQuestion'],
    reason: 'Merci de compléter ces deux informations indispensables.',
    status: 'REQUESTED',
    displayStatus: 'REQUESTED',
    data: {
      values: {},
      photoFields: [],
      fieldLabels: ['Lieu de naissance', 'Question ou intention de lecture'],
    },
    revision: 0,
    expiresAt: '2026-08-12T23:59:59.000Z',
    submittedAt: null,
    reviewedAt: null,
    updatedAt: '2026-08-05T12:00:00.000Z',
  };
  const calls = {
    drafts: [] as Array<Record<string, unknown>>,
    submissions: [] as Array<Record<string, unknown>>,
  };

  await page.addInitScript(() => {
    localStorage.setItem('sanctuaire_token', 'e2e-sanctuaire-token');
  });

  await page.route('**/api/auth/sanctuaire/session', (route) =>
    json(route, { authenticated: true }),
  );

  await page.route('**/api/bff/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/bff', '');

    if (request.method() === 'GET' && path === '/users/profile') {
      await json(route, {
        id: 'user-e2e',
        email: 'client@lumira.test',
        firstName: 'Ariane',
        lastName: 'Test',
        phone: null,
        profile: {
          birthDate: '1990-06-15',
          birthTime: null,
          birthPlace: null,
          specificQuestion: null,
          objective: null,
          openReading: false,
          facePhotoUrl: '/api/bff/users/profile/photos/face',
          palmPhotoUrl: '/api/bff/users/profile/photos/palm',
          highs: null,
          lows: null,
          strongSide: null,
          weakSide: null,
          strongZone: null,
          weakZone: null,
          deliveryStyle: null,
          pace: null,
          ailments: null,
          fears: null,
          rituals: null,
          profileCompleted: true,
          submittedAt: '2026-08-01T10:00:00.000Z',
        },
        stats: { totalOrders: 1, completedOrders: 1 },
      });
      return;
    }
    if (request.method() === 'GET' && path === '/users/entitlements') {
      await json(route, {
        capabilities: ['reading'],
        products: ['integrale'],
        highestLevel: 4,
        levelMetadata: {
          level: 4,
          name: 'Intégral',
          productId: 'integrale',
          price: 1700,
          color: 'horizon',
          icon: 'sparkles',
        },
        orderCount: 1,
      });
      return;
    }
    if (request.method() === 'GET' && path === '/users/onboarding') {
      await json(route, {
        orderId: 'order-e2e',
        currentStep: 4,
        status: 'COMPLETED',
        data: {},
        completedAt: '2026-08-01T10:00:00.000Z',
        revision: 1,
      });
      return;
    }
    if (request.method() === 'GET' && path === '/users/orders/completed') {
      await json(route, [
        {
          id: 'order-e2e',
          orderNumber: 'LUM-E2E',
          level: 4,
          status: 'COMPLETED',
          deliveredAt: '2026-08-02T10:00:00.000Z',
          createdAt: '2026-08-01T10:00:00.000Z',
          intakeRequired: true,
          intakeStatus: 'SEALED',
          intakeSealedAt: '2026-08-01T10:00:00.000Z',
        },
      ]);
      return;
    }
    if (request.method() === 'GET' && path === '/users/reading-amendments') {
      await json(route, [amendment]);
      return;
    }
    if (
      request.method() === 'PATCH' &&
      path === `/users/reading-amendments/${amendment.id}/draft`
    ) {
      const body = request.postDataJSON() as Record<string, unknown>;
      calls.drafts.push(body);
      amendment = {
        ...amendment,
        status: 'DRAFT',
        displayStatus: 'DRAFT',
        revision: 1,
        data: {
          ...amendment.data,
          values: body.values as Record<string, string>,
        },
        updatedAt: '2026-08-05T12:05:00.000Z',
      };
      await json(route, amendment);
      return;
    }
    if (
      request.method() === 'POST' &&
      path === `/users/reading-amendments/${amendment.id}/submit`
    ) {
      const body = request.postDataJSON() as Record<string, unknown>;
      calls.submissions.push(body);
      amendment = {
        ...amendment,
        status: 'SUBMITTED',
        displayStatus: 'SUBMITTED',
        revision: 2,
        submittedAt: '2026-08-05T12:10:00.000Z',
        updatedAt: '2026-08-05T12:10:00.000Z',
      };
      await json(route, amendment);
      return;
    }
    if (request.method() === 'GET' && path === '/client/readings') {
      await json(route, { readings: [] });
      return;
    }

    await json(route, {});
  });

  return calls;
}

test.describe('Compléments obligatoires dans le Sanctuaire', () => {
  test('mobile: le client enregistre puis transmet uniquement les champs demandés', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const calls = await installMocks(page);

    await page.goto('/sanctuaire');
    await expect(page.getByText('Action demandée par l’expert')).toBeVisible();
    await expect(page.getByLabel('Lieu de naissance')).toBeVisible();
    await expect(page.getByLabel('Question ou intention de lecture')).toBeVisible();
    await expect(page.getByLabel('Date de naissance')).toHaveCount(0);

    await page.getByLabel('Lieu de naissance').fill('Paris, France');
    await page
      .getByLabel('Question ou intention de lecture')
      .fill('Comment retrouver une direction claire dans cette période ?');
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    await expect.poll(() => calls.drafts.length).toBe(1);
    expect(calls.drafts[0]).toMatchObject({
      expectedRevision: 0,
      values: {
        birthPlace: 'Paris, France',
        specificQuestion: 'Comment retrouver une direction claire dans cette période ?',
      },
    });

    await page.getByRole('button', { name: 'Transmettre' }).click();
    await expect.poll(() => calls.submissions.length).toBe(1);
    expect(calls.submissions[0]).toMatchObject({
      expectedRevision: 1,
      values: {
        birthPlace: 'Paris, France',
        specificQuestion: 'Comment retrouver une direction claire dans cette période ?',
      },
    });
    await expect(page.getByText(/a bien été transmis/i)).toBeVisible();

    const overflow = await page.evaluate(() => ({
      viewport: window.innerWidth,
      body: document.body.scrollWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(overflow.body).toBeLessThanOrEqual(overflow.viewport + 2);
    expect(overflow.document).toBeLessThanOrEqual(overflow.viewport + 2);
  });
});
