import { expect, test } from '@playwright/test';
import { mockGuidanceRequestsApi, mockSanctuaireAuth } from '../../../tests/helpers/api-mock';
import { expectNoHorizontalOverflow } from './helpers/layout';

test.describe('Chat Sanctuaire mobile', () => {
  test('keeps the composer and the latest response reachable at simulated keyboard height', async ({
    page,
  }, testInfo) => {
    test.skip(
      !['mobile-chromium', 'mobile-webkit'].includes(testInfo.project.name),
      'Mobile browser coverage only',
    );
    await mockSanctuaireAuth(page);
    await mockGuidanceRequestsApi(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/sanctuaire/chat');

    await page.getByRole('button', { name: /^Comprendre ma mission/ }).click();
    const composer = page.getByLabel('Ajouter un message');
    await expect(composer).toBeVisible();
    await composer.focus();
    await page.setViewportSize({ width: 390, height: 420 });

    const message = `Je relis ce passage ${'sans-espace-'.repeat(18)}avec attention.`;
    await composer.fill(message);
    const send = page.getByRole('button', { name: 'Envoyer mon message à l’équipe' });
    await expect(send).toBeVisible();
    const [sendBox, navBox] = await Promise.all([
      send.boundingBox(),
      page.getByRole('navigation', { name: /navigation principale du sanctuaire/i }).boundingBox(),
    ]);
    expect(sendBox).not.toBeNull();
    expect(navBox).not.toBeNull();
    expect(sendBox!.y + sendBox!.height).toBeLessThanOrEqual(navBox!.y + 1);

    await send.click();
    await expect(page.getByText(message, { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
