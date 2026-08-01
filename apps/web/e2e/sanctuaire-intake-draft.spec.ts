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

type OrderResponse = {
  id: string;
  orderNumber: string;
  status: string;
  deliveredAt: string | null;
  createdAt: string;
  intakeRequired?: boolean;
  intakeStatus?: 'DRAFT' | 'SEALED' | null;
  intakeSealedAt?: string | null;
};

type MockOptions = {
  draft?: DraftResponse;
  orders?: OrderResponse[];
  onboardingGetStatus?: number;
  onOnboardingPatch?: (body: IntakeData) => void | Promise<void>;
};

const PRIVATE_FACE_REF = 's3://onboarding/e2e-client/face.png';
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
  let currentDraft: DraftResponse = {
    ...(options.draft ?? DEFAULT_DRAFT),
    data: { ...(options.draft?.data ?? DEFAULT_DRAFT.data) },
  };
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
    expect(await route.request().headerValue('content-type')).toMatch(/^image\//);
    // WebKit exposes the streamed Blob request as an empty buffer to Playwright,
    // while Chromium exposes its bytes. The private PUT plus persisted s3:// ref
    // below proves the cross-browser upload path without treating that omission as
    // an application failure.
    const body = route.request().postDataBuffer();
    if (body) expect(body.byteLength).toBeGreaterThan(0);
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
      await json(route, options.orders ?? []);
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
      await json(route, currentDraft);
      return;
    }

    if (request.method() === 'PATCH' && path === '/users/onboarding') {
      const body = request.postDataJSON() as IntakeData;
      calls.onboardingPatches.push(body);
      await options.onOnboardingPatch?.(body);
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
      await json(route, {
        ...currentDraft,
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

async function openOptionalSection(page: Page, name: RegExp) {
  const summary = page.getByText(name).first();
  await expect(summary).toBeVisible();
  await summary.click();
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
    await expect(page.getByRole('heading', { name: 'Vos photos privées' })).toBeVisible();
    await page.getByRole('button', { name: /^Continuer$/i }).click();
    await expect(page.getByRole('heading', { name: 'Relecture et transmission' })).toBeVisible();
    await openOptionalSection(page, /Ce qui me porte et ce qui me pèse/i);
    await expect(page.getByLabel(/soutient actuellement/i)).toHaveValue(draftData.highs);
    await expect(page.getByLabel(/pèse ou se répète/i)).toHaveValue(draftData.lows);

    const changedValue = 'Je souhaite maintenant avancer étape par étape.';
    await page.getByLabel(/pèse ou se répète/i).fill(changedValue);
    await page.getByRole('button', { name: 'Revenir à l’aperçu du dossier' }).click();

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

  test('garde le brouillon actif visible et modifiable malgré une commande plus récente vide', async ({
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
      deliveryStyle: 'DOUX_ET_CLAIR',
      pace: 50,
      facePhoto: '',
      palmPhoto: '',
    };
    await installSanctuaireMocks(page, {
      draft: {
        orderId: 'order-draft',
        currentStep: 2,
        status: 'IN_PROGRESS',
        data: draftData,
        completedAt: null,
        revision: 7,
        updatedAt: new Date().toISOString(),
        canEdit: true,
      },
      orders: [
        {
          id: 'order-newer-empty',
          orderNumber: 'LUM-NEWER',
          status: 'PAID',
          deliveredAt: null,
          createdAt: '2026-07-25T12:00:00.000Z',
          intakeRequired: true,
          intakeStatus: null,
          intakeSealedAt: null,
        },
        {
          id: 'order-draft',
          orderNumber: 'LUM-DRAFT',
          status: 'PAID',
          deliveredAt: null,
          createdAt: '2026-07-24T12:00:00.000Z',
          intakeRequired: true,
          intakeStatus: 'DRAFT',
          intakeSealedAt: null,
        },
      ],
    });

    await page.goto('/sanctuaire');
    await expect(
      page.getByRole('heading', { name: 'Vos informations déjà enregistrées' }),
    ).toBeVisible();
    await expect(page.getByText(draftData.specificQuestion, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Reprendre mon dossier' }).click();
    await expect(page.getByRole('heading', { name: 'Relecture et transmission' })).toBeVisible();
    await openOptionalSection(page, /Ce qui me porte et ce qui me pèse/i);
    await expect(page.getByLabel(/pèse ou se répète/i)).toHaveValue(draftData.lows);
    const changedLow = 'Je reprends mon élan avec des choix plus sereins.';
    await page.getByLabel(/pèse ou se répète/i).fill(changedLow);
    await page.getByRole('button', { name: 'Revenir à l’aperçu du dossier' }).click();
    await expect(
      page.getByRole('heading', { name: 'Vos informations déjà enregistrées' }),
    ).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Vos informations déjà enregistrées' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Reprendre mon dossier' }).click();
    await openOptionalSection(page, /Ce qui me porte et ce qui me pèse/i);
    await expect(page.getByLabel(/pèse ou se répète/i)).toHaveValue(changedLow);

    await page.goto('/sanctuaire/dossier');
    await expect(page.getByRole('heading', { name: 'Mon dossier de lecture' })).toBeVisible();
    await expect(page.getByText(draftData.birthPlace, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Reprendre et modifier' }).click();
    await openOptionalSection(page, /Ce qui me porte et ce qui me pèse/i);
    await expect(page.getByLabel(/pèse ou se répète/i)).toHaveValue(changedLow);
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

    await page.getByRole('button', { name: 'Revenir à l’aperçu du dossier' }).click();
    await expect
      .poll(() =>
        calls.onboardingPatches.some(
          (body) => (body.data as IntakeData | undefined)?.facePhoto === PRIVATE_FACE_REF,
        ),
      )
      .toBe(true);
  });

  test('persiste le ton depuis l’enrichissement facultatif de la relecture', async ({ page }) => {
    const calls = await installSanctuaireMocks(page);
    await openIntake(page);
    await advanceToHeading(page, 'Relecture et transmission');
    await openOptionalSection(page, /Mes préférences de lecture/i);

    await page.getByRole('radio', { name: /Direct et concret/i }).click();
    await expect(page.getByRole('radio', { name: /Direct et concret/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await expect
      .poll(() =>
        calls.onboardingPatches.some((body) => {
          const data = body.data as IntakeData | undefined;
          return body.currentStep === 3 && data?.deliveryStyle === 'DIRECT_ET_CONCRET';
        }),
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

    await page.waitForTimeout(1_000);
    expect(calls.onboardingPatches).toHaveLength(0);
  });

  test('hydrate un brouillon valide au format JSON string avec currentStep: 1 sur Intention', async ({
    page,
  }) => {
    await installSanctuaireMocks(page, {
      draft: {
        orderId: 'order-scoped-1',
        currentStep: 1,
        status: 'IN_PROGRESS',
        revision: 7,
        updatedAt: new Date().toISOString(),
        completedAt: null,
        canEdit: true,
        data: {
          usageName: 'Amnay',
          birthDate: '1990-01-01',
          birthPlace: 'Paris',
          specificQuestion: 'Quelle est ma voie ?',
          objective: 'Clarté spirituelle',
        },
      },
    });

    await page.goto('/sanctuaire?onboarding=1');
    await expect(page.getByRole('heading', { name: 'Ce qui vous amène' })).toBeVisible();
    await expect(page.getByLabel(/éclairer une seule question/i)).toHaveValue(
      'Quelle est ma voie ?',
    );
    await expect(page.getByLabel(/comprendre, décider|voir autrement/i)).toHaveValue(
      'Clarté spirituelle',
    );
    await page.getByRole('button', { name: /revenir à l’étape précédente/i }).click();
    await expect(page.getByLabel(/prénom par lequel/i)).toHaveValue('Amnay');
  });

  test('affiche Votre brouillon est prêt à être repris sur Accueil et la synthèse complète sur Mon dossier', async ({
    page,
  }) => {
    await installSanctuaireMocks(page, {
      draft: {
        orderId: 'order-scoped-1',
        currentStep: 1,
        status: 'IN_PROGRESS',
        revision: 7,
        updatedAt: new Date().toISOString(),
        completedAt: null,
        canEdit: true,
        data: {
          usageName: 'Amnay',
          birthDate: '1990-01-01',
          birthPlace: 'Paris',
          specificQuestion: 'Quelle est ma voie ?',
          objective: 'Clarté spirituelle',
        },
      },
    });

    await page.goto('/sanctuaire');
    await expect(
      page.getByRole('heading', { name: 'Votre brouillon est prêt à être repris' }),
    ).toBeVisible();
    await expect(page.getByText('Lieu : Paris')).toBeVisible();

    await page.goto('/sanctuaire/dossier');
    await expect(page.getByRole('heading', { name: 'Mon dossier de lecture' })).toBeVisible();
    await expect(page.getByText('Appelé(e) Amnay')).toBeVisible();
    await expect(page.getByText('Paris')).toBeVisible();
    await expect(page.getByText('Quelle est ma voie ?', { exact: true })).toBeVisible();
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

      const preparation = page.getByRole('region', { name: 'Vos repères essentiels' });
      const footer = preparation.locator('footer');
      const primaryAction = footer.getByRole('button', { name: /^Continuer$/i });
      await footer.scrollIntoViewIfNeeded();
      await expect(footer).toBeVisible();
      await expect(primaryAction).toBeVisible();

      const layout = await page.evaluate(() => {
        const preparationNode = document.querySelector(
          '[role="region"][aria-labelledby="reading-preparation-title"]',
        ) as HTMLElement | null;
        return {
          pageWidth: document.documentElement.scrollWidth,
          preparationWidth: preparationNode?.scrollWidth ?? 0,
          viewportWidth: window.innerWidth,
        };
      });
      expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
      expect(layout.preparationWidth).toBeLessThanOrEqual(layout.viewportWidth);

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
