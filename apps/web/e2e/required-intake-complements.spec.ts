import { expect, type Page, type Route, test } from '@playwright/test';

type JsonRecord = Record<string, unknown>;

const TEST_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'cache-control': 'no-store' },
    body: JSON.stringify(body),
  });
}

async function installMocks(page: Page) {
  let revision = 0;
  let status: 'REQUESTED' | 'DRAFT' | 'SUBMITTED' = 'REQUESTED';
  let values: JsonRecord = {};
  const calls = {
    drafts: [] as JsonRecord[],
    submissions: [] as JsonRecord[],
    uploads: [] as string[],
  };

  const amendment = () => ({
    id: 'ram-required-1',
    orderId: 'order-1',
    kind: 'PROFILE_FIELDS',
    requestedFields: [
      'intention',
      'facePhotoUrl',
      'palmPhotoUrl',
      'palmRole',
    ],
    reason: 'Merci de compléter les éléments indispensables à votre lecture.',
    status,
    displayStatus: status,
    data: {
      values,
      photoFields: Object.keys(values).filter((key) =>
        ['facePhotoUrl', 'palmPhotoUrl'].includes(key),
      ),
      fieldLabels: ['Intention de lecture', 'Photo du visage', 'Photo de la paume'],
    },
    revision,
    expiresAt: '2027-08-12T23:59:59.000Z',
    submittedAt: status === 'SUBMITTED' ? new Date().toISOString() : null,
    reviewedAt: null,
    updatedAt: new Date().toISOString(),
  });

  await page.route('**/api/auth/sanctuaire/session', (route) =>
    json(route, { authenticated: true }),
  );

  await page.route('**/api/bff/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/bff', '');

    if (request.method() === 'GET' && path === '/users/profile') {
      await json(route, {
        id: 'user-1',
        email: 'client@example.test',
        firstName: 'Client',
        lastName: 'Test',
        profile: null,
        stats: { totalOrders: 1, completedOrders: 0 },
      });
      return;
    }
    if (request.method() === 'GET' && path === '/users/entitlements') {
      await json(route, {
        capabilities: ['reading'],
        products: ['integrale'],
        highestLevel: 4,
        orderCount: 1,
      });
      return;
    }
    if (request.method() === 'GET' && path === '/users/orders/completed') {
      await json(route, [
        {
          id: 'order-1',
          orderNumber: 'LUM-1',
          status: 'PAID',
          intakeRequired: true,
          intakeStatus: 'SEALED',
          intakeSealedAt: '2026-08-01T10:00:00.000Z',
        },
      ]);
      return;
    }
    if (request.method() === 'GET' && path === '/users/onboarding') {
      await json(route, {
        currentStep: 4,
        status: 'COMPLETED',
        data: {},
        completedAt: '2026-08-01T10:00:00.000Z',
        canEdit: false,
      });
      return;
    }
    if (request.method() === 'GET' && path === '/users/reading-amendments') {
      await json(route, [amendment()]);
      return;
    }
    if (request.method() === 'POST' && path === '/uploads/onboarding-normalize') {
      const multipart = request.postData() || '';
      const kind = multipart.includes('FACE') ? 'face' : 'palm';
      calls.uploads.push(kind);
      await json(route, {
        storageRef: `s3://onboarding/user-1/${kind}-complement.jpg`,
        key: `onboarding/user-1/${kind}-complement.jpg`,
        contentType: 'image/jpeg',
        normalizedBytes: TEST_JPEG.length,
      });
      return;
    }
    if (
      request.method() === 'PATCH' &&
      path === '/users/reading-amendments/ram-required-1/draft'
    ) {
      const body = request.postDataJSON() as JsonRecord;
      calls.drafts.push(body);
      expect(body.expectedRevision).toBe(revision);
      values = { ...values, ...((body.values as JsonRecord) ?? {}) };
      revision += 1;
      status = 'DRAFT';
      await json(route, amendment());
      return;
    }
    if (
      request.method() === 'POST' &&
      path === '/users/reading-amendments/ram-required-1/submit'
    ) {
      const body = request.postDataJSON() as JsonRecord;
      calls.submissions.push(body);
      expect(body.expectedRevision).toBe(revision);
      values = { ...values, ...((body.values as JsonRecord) ?? {}) };
      revision += 1;
      status = 'SUBMITTED';
      await json(route, amendment());
      return;
    }

    await json(route, {});
  });

  return calls;
}

test.describe('Compléments obligatoires du Sanctuaire', () => {
  test('sauvegarde puis transmet intention, visage et paume sans exposer les refs', async ({
    page,
  }) => {
    const calls = await installMocks(page);
    await page.goto('/sanctuaire');

    await expect(page.getByText(/action demandée par l’expert/i)).toBeVisible();
    await page.getByRole('button', { name: /question précise/i }).click();
    await page
      .getByPlaceholder(/question que vous souhaitez éclairer/i)
      .fill('Que dois-je comprendre dans cette période de transition ?');

    await page.getByLabel(/choisir une photo pour visage demandé/i).setInputFiles({
      name: 'face.jpg',
      mimeType: 'image/jpeg',
      buffer: TEST_JPEG,
    });
    await page.getByRole('button', { name: /droite/i }).click();
    await page.getByLabel(/choisir une photo pour paume demandée/i).setInputFiles({
      name: 'palm.jpg',
      mimeType: 'image/jpeg',
      buffer: TEST_JPEG,
    });

    await page.getByRole('button', { name: /^Enregistrer$/i }).click();
    await expect.poll(() => calls.drafts.length).toBe(1);
    expect(calls.drafts[0]).toMatchObject({
      expectedRevision: 0,
      values: {
        intention: {
          intentionMode: 'QUESTION',
          openReading: false,
          specificQuestion: 'Que dois-je comprendre dans cette période de transition ?',
          objective: null,
        },
        facePhotoUrl: 's3://onboarding/user-1/face-complement.jpg',
        palmPhotoUrl: 's3://onboarding/user-1/palm-complement.jpg',
        palmRole: 'PALM_RIGHT',
      },
    });

    await page.getByRole('button', { name: /^Transmettre$/i }).click();
    await expect.poll(() => calls.submissions.length).toBe(1);
    expect(calls.submissions[0]).toMatchObject({ expectedRevision: 1 });
    await expect(page.getByText(/attend la vérification de l’expert/i)).toBeVisible();

    const body = await page.locator('body').innerText();
    expect(body).not.toContain('s3://onboarding/');
    expect(calls.uploads).toEqual(['face', 'palm']);
  });

  test('refuse une transmission sans les photos demandées', async ({ page }) => {
    const calls = await installMocks(page);
    await page.goto('/sanctuaire');

    await page.getByRole('button', { name: /lecture ouverte/i }).click();
    await page.getByRole('button', { name: /^Transmettre$/i }).click();

    await expect(page.getByText(/ajoutez et enregistrez cette photo/i).first()).toBeVisible();
    expect(calls.submissions).toHaveLength(0);
  });
});
