import { expect, test } from '@playwright/test';
import { mockFullSanctuaire } from '../../../tests/helpers/api-mock';
import { expectNoHorizontalOverflow } from './helpers/layout';

test.describe('Profil et réglages du Sanctuaire', () => {
  test('expose des réglages accessibles, des informations longues contenues et les demandes RGPD', async ({
    page,
  }) => {
    await mockFullSanctuaire(page, {
      user: {
        firstName: 'Alexandrine'.repeat(12),
        lastName: 'Montmorency'.repeat(12),
        email: `${'adresse.tres.longue.'.repeat(8)}@lumira.test`,
      },
    });
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/sanctuaire/profile');

    await expect(
      page.locator('main').getByText('Accès early · 3 mois', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Réglages' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto('/sanctuaire/settings/security');
    await expect(page.getByRole('heading', { name: /sécurité.*confidentialité/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Demander mon export' })).toHaveAttribute(
      'href',
      /mailto:contact@oraclelumira\.com/,
    );
    await expect(
      page.getByRole('link', { name: 'Demander la suppression de mon compte' }),
    ).toHaveAttribute('href', /mailto:contact@oraclelumira\.com/);
    await expectNoHorizontalOverflow(page);
  });
});
