import { expect, type Page, type Route, test } from '@playwright/test';

type IntakeData = Record<string, unknown>;

type MockOptions = {
  draft?: {
    currentStep: number;
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
    data: IntakeData;
    completedAt: string | null;
    revision?: number;
    updatedAt?: string;
  };
  onProfilePatch?: (body: IntakeData) => void | Promise<void>;
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

const COMPLETE_DATA = {
  schemaVersion: 2,
  birthDate: '1990-03-21',
  birthTime: '06:45',
  birthPlace: 'Casablanca, Maroc',
  specificQuestion: 'Comment choisir une voie professionnelle fidèle à mes valeurs ?',
  objective: 'Transformer mon hésitation en décision lucide et durable.',
  highs: 'La création, mes amitiés et les projets qui relient les personnes.',
  lows: 'Je reporte les décisions lorsque plusieurs voies semblent possibles.',
  ailments: 'Une tension dans les épaules pendant les périodes très chargées.',
  fears: 'Perdre ma stabilité en changeant de cap.',
  rituals: 'Dix minutes de journal et une marche quotidienne sans téléphone.',
  deliveryStyle: 'DIRECT_ET_CONCRET',
  pace: 80,
  facePhoto: '',
  palmPhoto: '',
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function installSanctuaireMocks(page: Page, options: MockOptions = {}) {
  const draft =
    options.draft ??
    ({
      currentStep: 0,
      status: 'NOT_STARTED',
      data: {},
      completedAt: null,
      revision: 1,
      updatedAt: new Date().toISOString(),
    } as const);
  const calls = {
    onboardingPatches: [] as IntakeData[],
    profilePatches: [] as IntakeData[],
  };

  await page.route('**/api/auth/sanctuaire/session', (route) =>
    json(route, { authenticated: true }),
  );

  await page.route('**/api/bff/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/bff', '');

    if (request.method() === 'GET' && path === '/users/profile') {
      await json(route, {
        id: 'client-sealing-e2e',
        email: 'client.sealing@lumira.test',
        firstName: 'Noor',
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
      await json(route, draft);
      return;
    }

    if (request.method() === 'PATCH' && path === '/users/onboarding') {
      const body = request.postDataJSON() as IntakeData;
      calls.onboardingPatches.push(body);
      await json(route, {
        ...draft,
        ...body,
        status: 'IN_PROGRESS',
        revision: (draft.revision ?? 1) + calls.onboardingPatches.length,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    if (request.method() === 'PATCH' && path === '/users/profile') {
      const body = request.postDataJSON() as IntakeData;
      calls.profilePatches.push(body);
      await options.onProfilePatch?.(body);
      await json(route, {
        profile: {
          ...EMPTY_PROFILE,
          ...body,
          profileCompleted: true,
          submittedAt: new Date().toISOString(),
        },
      });
      return;
    }

    await json(route, {});
  });

  return calls;
}

async function openIntake(page: Page, expectedHeading = 'Vos repères essentiels') {
  await page.goto('/sanctuaire?onboarding=1');
  await expect(page.getByRole('heading', { name: expectedHeading })).toBeVisible();
}

async function continueTo(page: Page, heading: string) {
  await page.getByRole('button', { name: /^Continuer$/i }).click();
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
}

test.describe('Relecture et scellement du dossier de lecture', () => {
  test('relit chaque réponse puis transmet exactement la version confirmée', async ({ page }) => {
    const calls = await installSanctuaireMocks(page);
    await openIntake(page);

    await page.getByLabel(/date de naissance/i).fill(COMPLETE_DATA.birthDate);
    await page.getByLabel(/heure/i).fill(COMPLETE_DATA.birthTime);
    await page.getByLabel(/lieu de naissance/i).fill(COMPLETE_DATA.birthPlace);
    await continueTo(page, 'Ce qui vous amène');

    await page.getByLabel(/éclairer une seule question/i).fill(COMPLETE_DATA.specificQuestion);
    await page.getByLabel(/comprendre, décider|voir autrement/i).fill(COMPLETE_DATA.objective);
    await continueTo(page, 'Votre contexte personnel');

    await page.getByLabel(/soutient actuellement/i).fill(COMPLETE_DATA.highs);
    await page.getByLabel(/pèse ou se répète/i).fill(COMPLETE_DATA.lows);
    await page.getByLabel(/contexte corporel/i).fill(COMPLETE_DATA.ailments);
    await page.getByLabel(/abordions avec douceur/i).fill(COMPLETE_DATA.fears);
    await page.getByLabel(/pratiques qui comptent/i).fill(COMPLETE_DATA.rituals);
    await page.getByLabel(/direct et concret/i).check();
    await page.getByLabel(/niveau de détail souhaité/i).evaluate((element, pace) => {
      const input = element as HTMLInputElement;
      input.value = String(pace);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, COMPLETE_DATA.pace);
    await continueTo(page, 'Vos photos privées');

    await continueTo(page, 'Relire et confirmer');
    for (const answer of [
      COMPLETE_DATA.birthPlace,
      COMPLETE_DATA.specificQuestion,
      COMPLETE_DATA.objective,
      COMPLETE_DATA.highs,
      COMPLETE_DATA.lows,
      COMPLETE_DATA.ailments,
      COMPLETE_DATA.fears,
      COMPLETE_DATA.rituals,
    ]) {
      await expect(page.getByText(answer, { exact: true })).toBeVisible();
    }
    await expect(page.getByText(/direct et concret/i)).toBeVisible();
    await expect(page.getByText('très détaillé', { exact: true })).toBeVisible();

    await page.getByLabel(/j’ai relu.*je choisis.*transmettre/i).check();
    await page.getByRole('button', { name: 'Confirmer et transmettre mon dossier' }).click();

    await expect.poll(() => calls.profilePatches.length).toBe(1);
    expect(calls.profilePatches[0]).toMatchObject({
      birthDate: COMPLETE_DATA.birthDate,
      birthTime: COMPLETE_DATA.birthTime,
      birthPlace: COMPLETE_DATA.birthPlace,
      specificQuestion: COMPLETE_DATA.specificQuestion,
      objective: COMPLETE_DATA.objective,
      highs: COMPLETE_DATA.highs,
      lows: COMPLETE_DATA.lows,
      ailments: COMPLETE_DATA.ailments,
      fears: COMPLETE_DATA.fears,
      rituals: COMPLETE_DATA.rituals,
      deliveryStyle: COMPLETE_DATA.deliveryStyle,
      pace: COMPLETE_DATA.pace,
      profileCompleted: true,
      consent: { accepted: true },
    });
    expect(calls.profilePatches[0].intakeRevision).toBe(1 + calls.onboardingPatches.length);
    await expect(
      page.getByRole('heading', { name: /votre lecture peut commencer/i }),
    ).toBeVisible();
  });

  test('neutralise deux confirmations déclenchées dans le même instant', async ({ page }) => {
    let releaseProfilePatch!: () => void;
    const profilePatchGate = new Promise<void>((resolve) => {
      releaseProfilePatch = resolve;
    });
    const calls = await installSanctuaireMocks(page, {
      draft: {
        currentStep: 4,
        status: 'IN_PROGRESS',
        data: COMPLETE_DATA,
        completedAt: null,
        revision: 12,
        updatedAt: new Date().toISOString(),
      },
      onProfilePatch: () => profilePatchGate,
    });

    await openIntake(page, 'Relire et confirmer');
    await page.getByLabel(/j’ai relu.*je choisis.*transmettre/i).check();
    const submit = page.getByRole('button', {
      name: 'Confirmer et transmettre mon dossier',
    });

    // Deux événements synchrones reproduisent le double tap avant le prochain rendu React.
    await submit.evaluate((element) => {
      element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await expect.poll(() => calls.profilePatches.length).toBe(1);
    await page.waitForTimeout(250);
    expect(calls.profilePatches).toHaveLength(1);
    await expect(submit).toBeDisabled();

    releaseProfilePatch();
    await expect(
      page.getByRole('heading', { name: /votre lecture peut commencer/i }),
    ).toBeVisible();
  });
});
