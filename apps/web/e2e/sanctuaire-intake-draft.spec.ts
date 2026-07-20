import { expect, type Page, type Route, test } from '@playwright/test';

type IntakeData = Record<string, unknown>;

type DraftResponse = {
  currentStep: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  data: IntakeData;
  completedAt: string | null;
  revision?: number;
  updatedAt?: string;
};

type MockOptions = {
  draft?: DraftResponse;
  onboardingGetStatus?: number;
  onOnboardingPatch?: (body: IntakeData) => void | Promise<void>;
};

const PRIVATE_FACE_REF = 's3://onboarding/e2e-client/face.png';
// Same-origin mock: the test exercises the PUT body without introducing a browser CORS preflight.
const PRIVATE_UPLOAD_URL = 'http://localhost:3000/__e2e__/private-upload/face.png';

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
  currentStep: 0,
  status: 'NOT_STARTED',
  data: {},
  completedAt: null,
  revision: 1,
  updatedAt: new Date().toISOString(),
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function installSanctuaireMocks(page: Page, options: MockOptions = {}) {
  const calls = {
    onboardingPatches: [] as IntakeData[],
    presigns: [] as IntakeData[],
    privatePuts: 0,
  };

  await page.route('**/api/auth/sanctuaire/session', (route) =>
    json(route, { authenticated: true }),
  );

  await page.route(`${PRIVATE_UPLOAD_URL}*`, async (route) => {
    calls.privatePuts += 1;
    expect(route.request().method()).toBe('PUT');
    expect(route.request().postDataBuffer()?.byteLength ?? 0).toBeGreaterThan(0);
    await route.fulfill({ status: 200, body: '' });
  });

  await page.route('**/api/bff/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/bff', '');

    if (request.method() === 'GET' && path === '/users/profile') {
      await json(route, {
        id: 'client-e2e',
        email: 'client.e2e@lumira.test',
        firstName: 'Ariane',
        lastName: 'Test',
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
      await json(route, []);
      return;
    }

    if (request.method() === 'GET' && path === '/users/onboarding') {
      if (options.onboardingGetStatus && options.onboardingGetStatus !== 200) {
        await json(
          route,
          { message: 'Le brouillon est momentanément indisponible.' },
          options.onboardingGetStatus,
        );
        return;
      }
      await json(route, options.draft ?? DEFAULT_DRAFT);
      return;
    }

    if (request.method() === 'PATCH' && path === '/users/onboarding') {
      const body = request.postDataJSON() as IntakeData;
      calls.onboardingPatches.push(body);
      await options.onOnboardingPatch?.(body);
      await json(route, {
        ...(options.draft ?? DEFAULT_DRAFT),
        ...body,
        status: 'IN_PROGRESS',
        revision: (options.draft?.revision ?? 1) + calls.onboardingPatches.length,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    if (request.method() === 'POST' && path === '/uploads/onboarding-presign') {
      const body = request.postDataJSON() as IntakeData;
      calls.presigns.push(body);
      await json(route, {
        uploadUrl: PRIVATE_UPLOAD_URL,
        storageRef: PRIVATE_FACE_REF,
      });
      return;
    }

    await json(route, {});
  });

  return calls;
}

async function openIntake(page: Page) {
  await page.goto('/sanctuaire?onboarding=1');
  await expect(page.getByRole('heading', { name: 'Vos repères essentiels' })).toBeVisible();
}

async function completeRequiredIdentity(page: Page) {
  const birthDate = page.getByLabel(/date de naissance/i);
  const birthPlace = page.getByLabel(/lieu de naissance/i);

  if (await birthDate.isVisible()) {
    if (!(await birthDate.inputValue())) await birthDate.fill('1991-04-18');
    if (!(await birthPlace.inputValue())) await birthPlace.fill('Lyon, France');
  }
}

async function advanceToHeading(page: Page, heading: string) {
  const target = page.getByRole('heading', { name: heading });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (await target.isVisible()) return;
    await completeRequiredIdentity(page);
    await page.getByRole('button', { name: /^Continuer$/i }).click();
  }
  await expect(target).toBeVisible();
}

test.describe('Brouillon du dossier de lecture', () => {
  test('enregistre immédiatement la dernière saisie avant de fermer', async ({ page }) => {
    let releasePatch!: () => void;
    const patchGate = new Promise<void>((resolve) => {
      releasePatch = resolve;
    });
    const place = 'Montréal, Canada — dernière saisie';
    const calls = await installSanctuaireMocks(page, {
      onOnboardingPatch: async (body) => {
        const data = body.data as IntakeData | undefined;
        if (data?.birthPlace === place) await patchGate;
      },
    });

    await openIntake(page);
    await page.getByLabel(/date de naissance/i).fill('1988-09-12');
    await page.getByLabel(/lieu de naissance/i).fill(place);
    await page
      .getByRole('button', { name: /enregistrer et reprendre plus tard/i })
      .first()
      .click();

    await expect
      .poll(
        () =>
          calls.onboardingPatches.some(
            (body) => (body.data as IntakeData | undefined)?.birthPlace === place,
          ),
        { timeout: 500 },
      )
      .toBe(true);

    // La fermeture attend la sauvegarde : le dialogue ne disparaît pas tant que le PATCH est bloqué.
    await expect(page.getByRole('heading', { name: 'Vos repères essentiels' })).toBeVisible();
    releasePatch();
    await expect(page.getByRole('heading', { name: 'Vos repères essentiels' })).toBeHidden();
  });

  test('reprend et modifie sans perte un brouillon créé il y a plus de 24 heures', async ({
    page,
  }) => {
    const draftData = {
      schemaVersion: 2,
      birthDate: '1986-02-14',
      birthTime: '07:35',
      birthPlace: 'Rabat, Maroc',
      specificQuestion: 'Comment retrouver une direction qui me ressemble ?',
      objective: 'Décider avec plus de sérénité.',
      highs: 'Mes proches et mon activité créative.',
      lows: 'Je doute au moment de choisir.',
      ailments: 'Tensions liées au stress.',
      fears: 'Décevoir en changeant de voie.',
      rituals: 'Marche silencieuse le matin.',
      deliveryStyle: 'DIRECT_ET_CONCRET',
      pace: 70,
      facePhoto: '',
      palmPhoto: '',
    };
    const calls = await installSanctuaireMocks(page, {
      draft: {
        currentStep: 0,
        status: 'IN_PROGRESS',
        data: draftData,
        completedAt: null,
        revision: 7,
        updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      },
    });

    await openIntake(page);
    await expect(page.getByLabel(/date de naissance/i)).toHaveValue('1986-02-14');
    await expect(page.getByLabel(/lieu de naissance/i)).toHaveValue('Rabat, Maroc');

    await page.getByRole('button', { name: /^Continuer$/i }).click();
    await expect(page.getByRole('heading', { name: 'Ce qui vous amène' })).toBeVisible();
    await expect(page.getByLabel(/éclairer une seule question/i)).toHaveValue(
      draftData.specificQuestion,
    );
    await expect(page.getByLabel(/comprendre, décider|voir autrement/i)).toHaveValue(
      draftData.objective,
    );

    await page.getByRole('button', { name: /^Continuer$/i }).click();
    await expect(page.getByRole('heading', { name: 'Votre contexte personnel' })).toBeVisible();
    await expect(page.getByLabel(/soutient actuellement/i)).toHaveValue(draftData.highs);
    await expect(page.getByLabel(/pèse ou se répète/i)).toHaveValue(draftData.lows);

    const changedValue = 'Je souhaite maintenant avancer étape par étape.';
    await page.getByLabel(/pèse ou se répète/i).fill(changedValue);
    await page
      .getByRole('button', { name: /enregistrer et reprendre plus tard/i })
      .first()
      .click();

    await expect
      .poll(() =>
        calls.onboardingPatches.some((body) => {
          const data = body.data as IntakeData | undefined;
          return (
            data?.lows === changedValue &&
            data?.specificQuestion === draftData.specificQuestion &&
            data?.rituals === draftData.rituals
          );
        }),
      )
      .toBe(true);
  });

  test('stocke la photo dans le bucket privé avant de persister sa référence', async ({ page }) => {
    const calls = await installSanctuaireMocks(page);
    await openIntake(page);
    await advanceToHeading(page, 'Vos photos privées');

    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nkwAAAAASUVORK5CYII=',
      'base64',
    );
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'visage.png',
      mimeType: 'image/png',
      buffer: png,
    });

    await expect.poll(() => calls.presigns.length).toBe(1);
    expect(calls.presigns[0]).toMatchObject({ kind: 'FACE' });
    await expect.poll(() => calls.privatePuts).toBe(1);

    await page
      .getByRole('button', { name: /enregistrer et reprendre plus tard/i })
      .first()
      .click();
    await expect
      .poll(() =>
        calls.onboardingPatches.some(
          (body) => (body.data as IntakeData | undefined)?.facePhoto === PRIVATE_FACE_REF,
        ),
      )
      .toBe(true);
  });

  test('une erreur de chargement ne transforme jamais le dossier en brouillon vide', async ({
    page,
  }) => {
    const calls = await installSanctuaireMocks(page, { onboardingGetStatus: 503 });

    await page.goto('/sanctuaire?onboarding=1');
    await expect(
      page.getByRole('heading', { name: 'Impossible de retrouver votre brouillon' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /réessayer/i })).toBeVisible();

    // Dépasse volontairement le délai d'autosave pour détecter tout PATCH destructeur.
    await page.waitForTimeout(1_000);
    expect(calls.onboardingPatches).toHaveLength(0);
  });

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 375, height: 812 },
  ]) {
    test(`garde le footer utilisable sans overflow en ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await installSanctuaireMocks(page);
      await openIntake(page);

      const dialog = page.getByRole('dialog');
      const footer = dialog.locator('footer');
      const primaryAction = footer.getByRole('button', { name: /^Continuer$/i });
      await expect(footer).toBeVisible();
      await expect(primaryAction).toBeVisible();

      const layout = await page.evaluate(() => {
        const dialogNode = document.querySelector('[role="dialog"]') as HTMLElement | null;
        return {
          pageWidth: document.documentElement.scrollWidth,
          dialogWidth: dialogNode?.scrollWidth ?? 0,
          viewportWidth: window.innerWidth,
        };
      });
      expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
      expect(layout.dialogWidth).toBeLessThanOrEqual(layout.viewportWidth);

      const footerBox = await footer.boundingBox();
      const actionBox = await primaryAction.boundingBox();
      expect(footerBox).not.toBeNull();
      expect(actionBox).not.toBeNull();
      expect(footerBox!.x).toBeGreaterThanOrEqual(0);
      expect(footerBox!.x + footerBox!.width).toBeLessThanOrEqual(viewport.width);
      expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(viewport.height);
      expect(actionBox!.height).toBeGreaterThanOrEqual(44);
    });
  }
});
