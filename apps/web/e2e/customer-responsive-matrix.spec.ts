import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { expectNoHorizontalOverflow } from './helpers/layout';

test.describe.configure({ timeout: 90_000 });

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'cache-control': 'no-store' },
    body: JSON.stringify(body),
  });
}

async function expectVisibleInViewport(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  const viewport = locator.page().viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.y).toBeLessThanOrEqual(viewport!.height);
  expect(box!.y + box!.height).toBeGreaterThanOrEqual(0);
}

async function installAuthenticatedCustomerMocks(page: Page) {
  await page.route('**/api/auth/sanctuaire/session', (route) =>
    json(route, { authenticated: true }),
  );

  await page.route('**/api/bff/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/bff', '');

    if (request.method() === 'GET' && path === '/users/profile') {
      await json(route, {
        id: 'responsive-client',
        email: 'ariane.responsive.longue@lumira.test',
        firstName: 'Ariane',
        lastName: 'Responsive',
        phone: '+33612345678',
        profile: {
          birthDate: '1991-04-18',
          birthTime: null,
          birthPlace: 'Lyon, France',
          specificQuestion: 'Comment avancer avec confiance ?',
          objective: 'Clarifier une décision.',
          facePhotoUrl: 's3://onboarding/responsive/face.jpg',
          palmPhotoUrl: 's3://onboarding/responsive/palm.jpg',
          profileCompleted: true,
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
          id: 'order-responsive',
          orderNumber: 'LUM-RESP',
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

    if (request.method() === 'GET' && path === '/users/onboarding') {
      await json(route, {
        orderId: 'order-responsive',
        currentStep: 3,
        status: 'COMPLETED',
        data: {},
        completedAt: '2026-07-28T09:30:00.000Z',
        revision: 1,
        updatedAt: '2026-07-28T09:30:00.000Z',
        canEdit: false,
      });
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
            id: 'reading-responsive',
            orderNumber: 'LUM-RESP',
            status: 'COMPLETED',
            deliveredAt: '2026-07-28T10:00:00.000Z',
            createdAt: '2026-07-28T09:00:00.000Z',
            title: 'Lecture responsive avec un titre volontairement long',
            archetype: 'Aube claire',
            intention: 'Clarifier une décision.',
            assets: {
              pdf: '/api/readings/LUM-RESP/file',
              audio: null,
            },
          },
        ],
      });
      return;
    }

    if (request.method() === 'GET' && path === '/client/requests') {
      await json(route, { data: [] });
      return;
    }

    await json(route, {});
  });
}

test('keeps the public entry points reachable at the configured viewport', async ({ page }) => {
  await page.route('**/api/auth/sanctuaire/session', (route) =>
    json(route, { authenticated: false }),
  );

  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const menuButton = page.getByRole('button', { name: 'Ouvrir le menu' });
  if (await menuButton.isVisible()) {
    await menuButton.click();
    const menu = page.getByRole('dialog', { name: 'Navigation principale' });
    await expect(menu).toBeVisible();
    await expectVisibleInViewport(menu.getByRole('link', { name: "L'Offre" }));
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(menuButton).toBeFocused();
  } else {
    await expectVisibleInViewport(page.getByRole('link', { name: 'Commencer', exact: true }));
  }

  await page.goto('/sanctuaire/login');
  const email = page.getByLabel('Email de commande');
  await expect(email).toBeVisible();
  await expect(email).toHaveAttribute('autocomplete', 'email');
  await expectVisibleInViewport(email);
  await expectNoHorizontalOverflow(page);
});

test('keeps checkout identity fields and primary action reachable', async ({ page }) => {
  await page.route('**/api/bff/users/profile', (route) =>
    route.fulfill({ status: 401, headers: { 'cache-control': 'no-store' } }),
  );

  await page.goto('/commande');
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Téléphone')).toHaveAttribute('inputmode', 'tel');
  await page.getByLabel('Email').fill('responsive@lumira.test');
  await page.getByLabel('Prénom').fill('Ariane');
  await page.getByLabel('Nom', { exact: true }).fill('Responsive');
  await expectVisibleInViewport(page.getByRole('button', { name: 'Payer 17€' }));
  await expectNoHorizontalOverflow(page);
});

test('keeps the authenticated Sanctuaire shell and profile menu keyboard-safe', async ({ page }) => {
  await installAuthenticatedCustomerMocks(page);
  await page.goto('/sanctuaire/draws');

  const shell = page.getByTestId('sanctuaire-shell');
  await expect(shell).toBeVisible();
  await expect(page.getByText('Lecture responsive avec un titre volontairement long')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const profileTrigger = page.getByRole('button', {
    name: 'Ouvrir le menu profil de Ariane Responsive',
  });
  await expectVisibleInViewport(profileTrigger);
  await profileTrigger.click();

  const profileMenu = page.getByRole('menu', { name: 'Profil et réglages' });
  await expect(profileMenu).toBeVisible();
  const firstItem = profileMenu.getByRole('menuitem').first();
  const lastItem = profileMenu.getByRole('menuitem').last();
  await expect(firstItem).toBeFocused();

  await page.keyboard.press('Shift+Tab');
  await expect(lastItem).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(firstItem).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(profileMenu).toBeHidden();
  await expect(profileTrigger).toBeFocused();
});

test('keeps customer messaging usable without content hidden by shell chrome', async ({ page }) => {
  await installAuthenticatedCustomerMocks(page);
  await page.goto('/sanctuaire/chat');

  await expect(page.getByRole('heading', { name: 'Demander un éclairage' })).toBeVisible();
  const createButton = page.getByRole('button', { name: 'Nouvelle demande' });
  await expectVisibleInViewport(createButton);
  await expect(page.getByText('Aucune demande pour le moment.')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await createButton.click();
  const subject = page.getByLabel('Sujet');
  await expect(subject).toBeVisible();
  await expect(subject).toBeFocused();
  await expectVisibleInViewport(page.getByRole('button', { name: 'Envoyer à l’équipe' }));
  await page.getByRole('button', { name: 'Fermer le formulaire' }).click();
  await expect(createButton).toBeFocused();
});
