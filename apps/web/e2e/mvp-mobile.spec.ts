import { expect, type Locator, type Page, type Route, test } from '@playwright/test';

type AuthController = {
  setAuthenticated: (next: boolean) => void;
  setOnboardingOpenable: (next: boolean) => void;
};

const PDF_BYTES = Buffer.from(
  'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAzMDAgMTQ0XSA+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAwNjQgMDAwMDAgbiAKMDAwMDAwMDEyMSAwMDAwMCBuIAp0cmFpbGVyCjw8IC9Sb290IDEgMCBSIC9TaXplIDQgPj4Kc3RhcnR4cmVmCjE5OQolJUVPRg==',
  'base64',
);

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function installAudioMock(page: Page) {
  await page.addInitScript(() => {
    class MockAudio extends EventTarget {
      src: string;
      preload = '';
      volume = 1;
      playbackRate = 1;
      paused = true;
      ended = false;
      duration = 180;
      currentTime = 0;

      constructor(src = '') {
        super();
        this.src = src;
        window.setTimeout(() => this.dispatchEvent(new Event('loadedmetadata')), 0);
      }

      async play() {
        this.paused = false;
        this.dispatchEvent(new Event('play'));
      }

      pause() {
        this.paused = true;
        this.dispatchEvent(new Event('pause'));
      }
    }

    Object.defineProperty(window, 'Audio', {
      configurable: true,
      writable: true,
      value: MockAudio,
    });
  });
}

async function installMvpMocks(page: Page): Promise<AuthController> {
  let authenticated = true;
  let onboardingOpenable = false;

  await page.route('**/api/auth/sanctuaire/session', (route) => json(route, { authenticated }));

  await page.route('**/api/bff/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/bff', '');

    if (request.method() === 'POST' && path === '/auth/sanctuaire-v2') {
      await json(route, {
        message: 'Si un accès existe pour cette adresse, un lien de connexion vient d’être envoyé.',
      });
      return;
    }

    if (request.method() === 'GET' && path === '/users/profile') {
      await json(route, {
        id: 'client-mvp',
        email: 'client.mvp@lumira.test',
        firstName: 'Ariane',
        lastName: 'MVP',
        phone: null,
        profile: {
          birthDate: '1991-04-18',
          birthTime: null,
          birthPlace: 'Lyon, France',
          specificQuestion: 'Comment avancer avec confiance ?',
          objective: 'Clarifier une décision.',
          facePhotoUrl: 's3://onboarding/mvp/face.jpg',
          palmPhotoUrl: 's3://onboarding/mvp/palm.jpg',
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
          profileCompleted: !onboardingOpenable,
          submittedAt: '2026-07-28T10:00:00.000Z',
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
          id: 'order-mvp',
          orderNumber: 'LUM-MVP',
          status: 'PAID',
          deliveredAt: '2026-07-28T10:00:00.000Z',
          createdAt: '2026-07-28T09:00:00.000Z',
          intakeRequired: true,
          intakeStatus: onboardingOpenable ? 'DRAFT' : 'SEALED',
          intakeSealedAt: onboardingOpenable ? null : '2026-07-28T09:30:00.000Z',
        },
      ]);
      return;
    }

    if (request.method() === 'GET' && path === '/users/onboarding') {
      await json(route, {
        orderId: 'order-mvp',
        currentStep: 0,
        status: onboardingOpenable ? 'NOT_STARTED' : 'COMPLETED',
        data: {},
        completedAt: onboardingOpenable ? null : '2026-07-28T09:30:00.000Z',
        revision: 1,
        updatedAt: '2026-07-28T09:30:00.000Z',
        canEdit: onboardingOpenable,
      });
      return;
    }

    if (request.method() === 'GET' && path === '/client/readings') {
      await json(route, {
        pending: [],
        readings: [
          {
            id: 'reading-mvp',
            orderNumber: 'LUM-MVP',
            status: 'COMPLETED',
            deliveredAt: '2026-07-28T10:00:00.000Z',
            createdAt: '2026-07-28T09:00:00.000Z',
            title: 'Lecture MVP mobile avec titre long vérifiable',
            archetype: 'Aube claire',
            intention: 'Clarifier une décision.',
            assets: {
              pdf: '/api/readings/LUM-MVP/file',
              audio: '/api/audio/mvp.mp3',
            },
          },
        ],
      });
      return;
    }

    if (request.method() === 'GET' && path === '/readings/LUM-MVP/file') {
      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: PDF_BYTES,
      });
      return;
    }

    await json(route, {});
  });

  return {
    setAuthenticated(next: boolean) {
      authenticated = next;
    },
    setOnboardingOpenable(next: boolean) {
      onboardingOpenable = next;
    },
  };
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewport + 2);
  expect(overflow.bodyWidth).toBeLessThanOrEqual(overflow.viewport + 2);
}

async function expectAboveMobileNav(page: Page, locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible();
  const nav = page.getByRole('navigation', { name: /navigation principale du sanctuaire/i });
  if (!(await nav.isVisible().catch(() => false))) return;
  const [targetBox, navBox] = await Promise.all([locator.boundingBox(), nav.boundingBox()]);
  expect(targetBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  expect(targetBox!.y + targetBox!.height).toBeLessThanOrEqual(navBox!.y + 1);
}

async function expectSingleScroll(page: Page, mode: 'main' | 'pdf') {
  const scrollables = await page.evaluate(() =>
    Array.from(document.querySelectorAll('body, main, [data-testid="reading-pdf-scroll"]'))
      .filter((node) => {
        const element = node as HTMLElement;
        const style = window.getComputedStyle(element);
        const canScrollY = /(auto|scroll)/.test(style.overflowY);
        const canScrollX = /(auto|scroll)/.test(style.overflowX);
        return (
          (canScrollY && element.scrollHeight > element.clientHeight + 2) ||
          (canScrollX && element.scrollWidth > element.clientWidth + 2)
        );
      })
      .map(
        (node) =>
          (node as HTMLElement).tagName.toLowerCase() +
          ':' +
          ((node as HTMLElement).dataset.testid ?? ''),
      ),
  );

  if (mode === 'pdf') {
    expect(scrollables.some((entry) => entry.startsWith('main:'))).toBe(false);
    expect(scrollables.some((entry) => entry.startsWith('body:'))).toBe(false);
    return;
  }

  expect(scrollables.filter((entry) => entry.startsWith('main:')).length).toBeLessThanOrEqual(1);
  expect(scrollables.some((entry) => entry === 'div:reading-pdf-scroll')).toBe(false);
}

async function expectFourMobileNavItems(page: Page) {
  const nav = page.getByRole('navigation', { name: /navigation principale du sanctuaire/i });
  await expect(nav.getByRole('link')).toHaveCount(4);
  await expect(nav.getByRole('link', { name: 'Accueil' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Mes lectures' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Ma synthèse' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Demander un éclairage' })).toBeVisible();
}

async function openReading(page: Page) {
  await page.goto('/sanctuaire/draws');
  await expect(page.getByRole('heading', { name: 'Mes lectures' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectSingleScroll(page, 'main');

  const audioPlayer = page.getByTestId('audio-player');
  await expect(audioPlayer).toBeVisible();
  await expectAboveMobileNav(page, audioPlayer);

  const play = page.getByRole('button', { name: 'Lire l’audio' });
  await expect(play).toBeVisible();
  await play.click();
  const pause = page.getByRole('button', { name: 'Mettre l’audio en pause' });
  await expect(pause).toBeVisible();
  await expect(page.getByLabel('Progression audio')).toBeVisible();
  await pause.click();
  await expect(play).toBeVisible();

  const readLink = page.getByRole('link', { name: /lire ma lecture/i });
  await expectAboveMobileNav(page, readLink);
  await readLink.click();
  await expect(page.getByTestId('reading-pdf-viewer')).toBeVisible();
}

async function assertPdfViewer(page: Page) {
  await expect(page.getByRole('link', { name: 'Fermer le PDF' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Page précédente' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Page suivante' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zoom arrière' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zoom avant' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Télécharger' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ouvrir dans un nouvel onglet' })).toBeVisible();
  await page.getByRole('button', { name: 'Zoom avant' }).click();
  await expectSingleScroll(page, 'pdf');
  await expectNoHorizontalOverflow(page);
}

test.describe('MVP mobile reading responsive', () => {
  test.describe.configure({ timeout: 60_000 });

  test('Chromium mobile 320: landing, checkout, login, onboarding, Sanctuaire, PDF and audio', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium');
    await page.setViewportSize({ width: 320, height: 568 });
    await installAudioMock(page);
    const auth = await installMvpMocks(page);

    await page.goto('/');
    await expectNoHorizontalOverflow(page);
    await page.goto('/commande');
    await expect(page.locator('body')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    auth.setAuthenticated(false);
    await page.goto('/sanctuaire/login');
    await expect(page.getByRole('heading', { name: 'Sanctuaire Lumira' })).toBeVisible();
    await page.locator('input[type="email"]').fill('client.mvp@lumira.test');
    await expect(page.getByRole('button', { name: /recevoir un lien sécurisé/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    auth.setAuthenticated(true);
    auth.setOnboardingOpenable(true);
    await page.goto('/sanctuaire?onboarding=1');
    await expect(page.getByRole('heading', { name: 'Vos repères essentiels' })).toBeVisible();
    await expectAboveMobileNav(page, page.getByRole('button', { name: /^Continuer$/i }));
    await expectNoHorizontalOverflow(page);

    auth.setOnboardingOpenable(false);
    await openReading(page);
    await assertPdfViewer(page);
    await page.getByRole('link', { name: 'Fermer le PDF' }).click();
    await expect(page.getByRole('heading', { name: 'Mes lectures' })).toBeVisible();
  });

  test('Chromium mobile Pixel 5: navigation basse, PDF and audio remain reachable', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium');
    await installAudioMock(page);
    await installMvpMocks(page);

    await page.goto('/sanctuaire/draws');
    await expectFourMobileNavItems(page);
    await expectNoHorizontalOverflow(page);
    await openReading(page);
    await assertPdfViewer(page);
    await page.getByRole('link', { name: 'Fermer le PDF' }).click();
    await expect(page.getByRole('button', { name: 'Lire l’audio' })).toBeVisible();
  });

  test('WebKit mobile: login, onboarding, PDF close and audio launch', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-webkit');
    await installAudioMock(page);
    const auth = await installMvpMocks(page);

    auth.setAuthenticated(false);
    await page.goto('/sanctuaire/login');
    await expect(page.getByRole('heading', { name: 'Sanctuaire Lumira' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    auth.setAuthenticated(true);
    auth.setOnboardingOpenable(true);
    await page.goto('/sanctuaire?onboarding=1');
    await expect(page.getByRole('heading', { name: 'Vos repères essentiels' })).toBeVisible();

    auth.setOnboardingOpenable(false);
    await openReading(page);
    await assertPdfViewer(page);
    await page.getByRole('link', { name: 'Fermer le PDF' }).click();
    await page.getByRole('button', { name: 'Lire l’audio' }).click();
    await expect(page.getByRole('button', { name: 'Mettre l’audio en pause' })).toBeVisible();
  });

  test('Desktop Chromium: landing, checkout, Sanctuaire and reading', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium');
    await page.setViewportSize({ width: 1440, height: 900 });
    await installAudioMock(page);
    await installMvpMocks(page);

    await page.goto('/');
    await expectNoHorizontalOverflow(page);
    await page.goto('/commande');
    await expect(page.locator('body')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.goto('/sanctuaire');
    await expect(page.locator('body')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.goto('/sanctuaire/lecture/LUM-MVP', { waitUntil: 'domcontentloaded' });
    await assertPdfViewer(page);
  });
});
