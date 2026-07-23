import { expect, test } from '@playwright/test';
import {
  normalizeLegacyDeliveryStyle,
  normalizeLegacyOnboardingPayload,
} from '../lib/legacy-onboarding';

test.describe('Compatibilité de l’ancien onboarding', () => {
  test('convertit les anciens styles sans altérer les valeurs actuelles', () => {
    expect(normalizeLegacyDeliveryStyle('Gentle')).toBe('DOUX_ET_CLAIR');
    expect(normalizeLegacyDeliveryStyle('Direct')).toBe('DIRECT_ET_CONCRET');
    expect(normalizeLegacyDeliveryStyle('Mystic')).toBe('SYMBOLIQUE_ET_PROFOND');
    expect(normalizeLegacyDeliveryStyle('DIRECT_ET_CONCRET')).toBe('DIRECT_ET_CONCRET');
  });

  test('normalise uniquement le style du brouillon historique', () => {
    const payload = {
      status: 'IN_PROGRESS',
      currentStep: 2,
      data: {
        deliveryStyle: 'Mystic',
        spiritualQuestion: 'Que dois-je comprendre de cette période ?',
      },
    };

    expect(normalizeLegacyOnboardingPayload(payload)).toEqual({
      status: 'IN_PROGRESS',
      currentStep: 2,
      data: {
        deliveryStyle: 'SYMBOLIQUE_ET_PROFOND',
        spiritualQuestion: 'Que dois-je comprendre de cette période ?',
      },
    });
  });

  test('purge les anciennes données locales au montage du Sanctuaire', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('holistic_wizard_draft', '{"highs":"donnée privée"}');
      localStorage.setItem('holistic_wizard_email', 'legacy@example.com');
      sessionStorage.setItem('sanctuaire_email', 'legacy@example.com');
    });

    await page.route('**/api/auth/sanctuaire/session', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ authenticated: false }),
      }),
    );

    await page.goto('/sanctuaire');

    await expect
      .poll(() =>
        page.evaluate(() => ({
          draft: localStorage.getItem('holistic_wizard_draft'),
          email: localStorage.getItem('holistic_wizard_email'),
          sessionEmail: sessionStorage.getItem('sanctuaire_email'),
        })),
      )
      .toEqual({ draft: null, email: null, sessionEmail: null });
  });
});
