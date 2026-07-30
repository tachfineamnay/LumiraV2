import { expect, type Page, type Route, test } from '@playwright/test';

const EXPERT = {
  id: 'expert-e2e',
  email: 'expert@lumira.test',
  name: 'Expert E2E',
  role: 'ADMIN',
  isActive: true,
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: {
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  });
}

async function installDeskMocks(page: Page) {
  await page.addInitScript((expert) => {
    localStorage.setItem('expert_token', 'expert-token-e2e');
    localStorage.setItem('expert_user', JSON.stringify(expert));
  }, EXPERT);

  await page.route('**/api/expert/**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
          'Access-Control-Allow-Origin': '*',
        },
      });
      return;
    }

    const path = new URL(request.url()).pathname;
    if (path.endsWith('/expert/verify')) {
      await json(route, { valid: true, expert: EXPERT });
    } else if (path.endsWith('/expert/stats')) {
      await json(route, {
        pendingOrders: 1,
        processingOrders: 1,
        validationOrders: 1,
        completedOrders: 4,
        ordersToday: 1,
        revenueToday: 1700,
      });
    } else if (path.includes('/expert/activity')) {
      await json(route, { activities: [] });
    } else if (path.includes('/expert/requests')) {
      await json(route, { data: [] });
    } else if (path.endsWith('/expert/production/summary')) {
      await json(route, { queued: 0, running: 0, failed: 0, awaitingReview: 0, audioMissing: 0 });
    } else if (path.includes('/expert/orders/')) {
      await json(route, { data: [] });
    } else {
      await json(route, {});
    }
  });
}

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport + 2);
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewport + 2);
}

test.describe('Desk expert responsive', () => {
  test.describe.configure({ timeout: 120_000 });

  test('Android et iPhone: navigation accessible et Kanban tactile contenu', async ({
    page,
  }, testInfo) => {
    test.skip(!['mobile-chromium', 'mobile-webkit'].includes(testInfo.project.name));
    await page.setViewportSize({ width: 320, height: 568 });
    await installDeskMocks(page);

    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /expert/i })).toBeVisible();
    await expectNoPageOverflow(page);

    const menuButton = page.getByRole('button', { name: 'Ouvrir le menu' });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    const drawer = page.getByRole('dialog', { name: 'Navigation' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Fermer le menu' })).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe('hidden');

    await drawer.getByRole('link', { name: 'Board', exact: true }).click();
    await expect(drawer).toBeHidden();
    await expect(page).toHaveURL(/\/admin\/board$/);
    await expect(page.getByRole('heading', { name: 'Lectures' })).toBeVisible();
    await expect(menuButton).toBeFocused();
    await expectNoPageOverflow(page);

    const kanban = page.getByTestId('desk-kanban-scroll');
    await expect(kanban).toBeVisible();
    const before = await kanban.evaluate((element) => ({
      left: element.scrollLeft,
      width: element.clientWidth,
      contentWidth: element.scrollWidth,
    }));
    expect(before.contentWidth).toBeGreaterThan(before.width);
    await kanban.evaluate((element) => element.scrollTo({ left: element.clientWidth, behavior: 'instant' }));
    await expect.poll(() => kanban.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  });

  test('Desktop: sidebar, dashboard et Kanban restent contenus', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium');
    await page.setViewportSize({ width: 1440, height: 900 });
    await installDeskMocks(page);

    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /expert/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ouvrir le menu' })).toBeHidden();
    await expectNoPageOverflow(page);

    await page.getByRole('link', { name: 'Board', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Lectures' })).toBeVisible();
    await expect(page.getByTestId('desk-kanban-scroll')).toBeVisible();
    await expectNoPageOverflow(page);
  });
});
