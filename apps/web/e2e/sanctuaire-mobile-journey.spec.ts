import { expect, type Page, type Route, test } from '@playwright/test';

type IntakeData = Record<string, unknown>;

type DraftResponse = {
  orderId?: string;
  currentStep: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  data: IntakeData;
  completedAt: string | null;
  revision?: number;
  updatedAt?: string;
  canEdit?: boolean;
};

const EMPTY_PROFILE = {
  birthDate: null,
  birthTime: null,
  birthPlace: null,
  specificQuestion: null,
  objective: null,
  facePhotoUrl: null,
  palmPhotoUrl: null,
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
  profileCompleted: false,
  submittedAt: null,
};

const DEFAULT_DRAFT: DraftResponse = {
  orderId: 'order-mobile',
  currentStep: 0,
  status: 'NOT_STARTED',
  data: {},
  completedAt: null,
  revision: 1,
  updatedAt: new Date().toISOString(),
  canEdit: true,
};

const FACE_REF = 's3://onboarding/mobile-client/face.jpg';
const PALM_REF = 's3://onboarding/mobile-client/palm.jpg';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nkwAAAAASUVORK5CYII=',
  'base64',
);

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function installLoginMocks(page: Page) {
  await page.route('**/api/auth/sanctuaire/session', (route) =>
    json(route, { authenticated: false }),
  );
  await page.route('**/api/bff/auth/sanctuaire-v2', (route) =>
    json(route, {
      message: 'Si un accès existe pour cette adresse, un lien de connexion vient d’être envoyé.',
    }),
  );
}

async function installSanctuaireMocks(page: Page) {
  let currentDraft: DraftResponse = { ...DEFAULT_DRAFT, data: { ...DEFAULT_DRAFT.data } };
  const calls = {
    onboardingPatches: [] as IntakeData[],
    presigns: [] as IntakeData[],
    profilePatches: [] as IntakeData[],
    privatePuts: [] as string[],
  };

  await page.route('**/api/auth/sanctuaire/session', (route) =>
    json(route, { authenticated: true }),
  );

  await page.route('**/__e2e__/private-upload/**', async (route) => {
    calls.privatePuts.push(route.request().url());
    expect(route.request().method()).toBe('PUT');
    await route.fulfill({ status: 200, body: '' });
  });

  await page.route('**/api/bff/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/bff', '');

    if (request.method() === 'GET' && path === '/users/profile') {
      await json(route, {
        id: 'client-mobile-e2e',
        email: 'client.mobile@lumira.test',
        firstName: 'Ariane',
        lastName: 'Mobile',
        phone: null,
        profile: EMPTY_PROFILE,
        stats: { totalOrders: 1, completedOrders: 0 },
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
          price: 0,
          color: 'horizon',
          icon: 'sparkles',
        },
        orderCount: 1,
      });
      return;
    }

    if (request.method() === 'GET' && path === '/users/orders/completed') {
      await json(route, [
        {
          id: 'order-mobile',
          orderNumber: 'LUM-MOBILE',
          status: 'PAID',
          deliveredAt: null,
          createdAt: '2026-07-28T10:00:00.000Z',
          intakeRequired: true,
          intakeStatus: currentDraft.status === 'COMPLETED' ? 'SEALED' : 'DRAFT',
          intakeSealedAt: currentDraft.status === 'COMPLETED' ? new Date().toISOString() : null,
        },
      ]);
      return;
    }

    if (request.method() === 'GET' && path === '/users/onboarding') {
      await json(route, currentDraft);
      return;
    }

    if (request.method() === 'PATCH' && path === '/users/onboarding') {
      const body = request.postDataJSON() as IntakeData;
      calls.onboardingPatches.push(body);
      currentDraft = {
        ...currentDraft,
        ...body,
        data: {
          ...currentDraft.data,
          ...((body.data as IntakeData | undefined) ?? {}),
        },
        status: 'IN_PROGRESS',
        revision: (currentDraft.revision ?? 1) + 1,
        updatedAt: new Date().toISOString(),
      };
      await json(route, currentDraft);
      return;
    }

    if (request.method() === 'POST' && path === '/uploads/onboarding-presign') {
      const body = request.postDataJSON() as IntakeData;
      const kind = body.kind === 'PALM' ? 'palm' : 'face';
      calls.presigns.push(body);
      await json(route, {
        uploadUrl: `http://localhost:3000/__e2e__/private-upload/${kind}.jpg`,
        storageRef: kind === 'palm' ? PALM_REF : FACE_REF,
      });
      return;
    }

    if (request.method() === 'PATCH' && path === '/users/profile') {
      const body = request.postDataJSON() as IntakeData;
      calls.profilePatches.push(body);
      currentDraft = {
        ...currentDraft,
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
        data: { ...currentDraft.data, ...body },
      };
      await json(route, {
        profile: { ...EMPTY_PROFILE, ...body, profileCompleted: true },
      });
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

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewport);
  expect(overflow.bodyWidth).toBeLessThanOrEqual(overflow.viewport);
}

async function expectVisibleAboveBottomNav(page: Page, buttonName: RegExp | string) {
  const button = page.getByRole('button', { name: buttonName }).last();
  await expect(button).toBeVisible();
  const [buttonBox, navBox] = await Promise.all([
    button.boundingBox(),
    page.getByRole('navigation', { name: /navigation principale/i }).boundingBox(),
  ]);
  expect(buttonBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(navBox!.y + 1);
}

async function openOnboarding(page: Page) {
  await page.goto('/sanctuaire?onboarding=1');
  await expect(page.getByRole('heading', { name: 'Vos repères essentiels' })).toBeVisible();
}

test.describe('Sanctuaire mobile connexion et onboarding', () => {
  test('navigation basse et contenu restent accessibles en paysage court', async ({ page }) => {
    await page.setViewportSize({ width: 568, height: 320 });
    await installSanctuaireMocks(page);

    await openOnboarding(page);
    const navigation = page.getByRole('navigation', { name: /navigation principale/i });
    await expect(navigation.getByRole('link')).toHaveCount(4);
    await expectVisibleAboveBottomNav(page, /^Continuer$/i);
    await expectNoHorizontalOverflow(page);

    const documentScrolls = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight + 1,
    );
    expect(documentScrolls).toBe(false);
  });

  test('connexion scrollable sur 320px et hauteur réduite clavier', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await installLoginMocks(page);

    await page.goto('/sanctuaire/login');
    await expect(page.getByRole('heading', { name: 'Sanctuaire Lumira' })).toBeVisible();
    await expect(page.locator('input[type="email"]')).not.toBeFocused();
    await expectNoHorizontalOverflow(page);

    await page.locator('input[type="email"]').focus();
    await page.locator('input[type="email"]').fill('mobile@lumira.test');
    await page.setViewportSize({ width: 320, height: 360 });
    await expect(page.getByRole('button', { name: /recevoir un lien sécurisé/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const focused = await page.evaluate(() => {
      const element = document.activeElement?.getBoundingClientRect();
      return element
        ? { top: element.top, bottom: element.bottom, height: window.innerHeight }
        : null;
    });
    expect(focused).not.toBeNull();
    expect(focused!.top).toBeGreaterThanOrEqual(0);
    expect(focused!.bottom).toBeLessThanOrEqual(focused!.height);

    await page.getByRole('button', { name: /recevoir un lien sécurisé/i }).click();
    await expect(page.getByText(/un lien de connexion vient d’être envoyé/i)).toBeVisible();
  });

  test('parcourt, reprend et confirme le dossier avec photos sur mobile', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    const calls = await installSanctuaireMocks(page);

    await openOnboarding(page);
    await expectVisibleAboveBottomNav(page, /^Continuer$/i);
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: /^Continuer$/i }).click();
    const birthDate = page.getByLabel(/date de naissance/i);
    await expect(birthDate).toBeVisible();
    await expect(birthDate).toBeFocused();

    await birthDate.fill('1991-04-18');
    await page.getByLabel(/lieu de naissance/i).fill('Lyon, France');
    await page.getByRole('button', { name: /^Continuer$/i }).click();
    await expect(page.getByRole('heading', { name: 'Ce qui vous amène' })).toBeVisible();

    await page.getByLabel(/éclairer une seule question/i).fill('Comment avancer avec confiance ?');
    await page.getByRole('button', { name: /ajouter ce que j’aimerais comprendre/i }).click();
    await page.getByLabel(/comprendre, décider|voir autrement/i).fill('Clarifier une décision.');
    await page.getByRole('button', { name: /^Continuer$/i }).click();
    await expect(page.getByRole('heading', { name: 'Vos photos privées' })).toBeVisible();

    await page.locator('input[type="file"]').nth(0).setInputFiles({
      name: 'visage.png',
      mimeType: 'image/png',
      buffer: PNG,
    });
    await expect.poll(() => calls.presigns.some((body) => body.kind === 'FACE')).toBe(true);
    await expect.poll(() => calls.privatePuts.some((url) => url.includes('/face.jpg'))).toBe(true);

    await page.locator('input[type="file"]').nth(2).setInputFiles({
      name: 'paume.png',
      mimeType: 'image/png',
      buffer: PNG,
    });
    await expect.poll(() => calls.presigns.some((body) => body.kind === 'PALM')).toBe(true);
    await expect.poll(() => calls.privatePuts.some((url) => url.includes('/palm.jpg'))).toBe(true);
    await expectVisibleAboveBottomNav(page, /^Continuer$/i);

    await page.getByRole('button', { name: /^Continuer$/i }).click();
    await expect(page.getByRole('heading', { name: 'Relecture et transmission' })).toBeVisible();
    await expect(page.getByText('Photo enregistrée')).toHaveCount(2);

    await page.getByRole('button', { name: 'Revenir à l’étape précédente' }).click();
    await expect(page.getByRole('heading', { name: 'Vos photos privées' })).toBeVisible();
    await page.getByRole('button', { name: /^Continuer$/i }).click();
    await expect(page.getByRole('heading', { name: 'Relecture et transmission' })).toBeVisible();

    await page.getByRole('button', { name: 'Revenir à l’aperçu du dossier' }).click();
    await expect(
      page.getByRole('heading', { name: 'Vos informations déjà enregistrées' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Reprendre mon dossier' }).click();
    await expect(page.getByRole('heading', { name: 'Relecture et transmission' })).toBeVisible();

    await page.getByLabel(/j’ai relu.*je choisis.*transmettre/i).check();
    await expectVisibleAboveBottomNav(page, 'Confirmer et transmettre mon dossier');
    await page.getByRole('button', { name: 'Confirmer et transmettre mon dossier' }).click();
    await expect.poll(() => calls.profilePatches.length).toBe(1);
    expect(calls.profilePatches[0]).toMatchObject({
      birthDate: '1991-04-18',
      birthPlace: 'Lyon, France',
      facePhotoUrl: FACE_REF,
      palmPhotoUrl: PALM_REF,
      profileCompleted: true,
      consent: { accepted: true },
    });
    await expect(
      page.getByRole('heading', { name: /votre lecture peut commencer/i }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
