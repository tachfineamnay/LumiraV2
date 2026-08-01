/**
 * E2E — Desk settings page regression test.
 * Verifies that /admin/settings renders correctly with a current readiness API
 * response that no longer includes the retired activeRoutingRules field.
 */
import { test, expect } from '@playwright/test';

const EXPERT = {
  id: 'expert-1',
  email: 'expert@example.test',
  name: 'Expert Test',
  role: 'EXPERT',
  isActive: true,
};

test.describe('Desk — Paramètres IA', () => {
  test('renders readiness verdict, checks, telemetry, and tabs without activeRoutingRules', async ({
    page,
  }) => {
    await page.addInitScript((expert) => {
      localStorage.setItem('expert_token', 'mock-expert-token');
      localStorage.setItem('expert_user', JSON.stringify(expert));
    }, EXPERT);

    await page.route('**/api/expert/verify', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ valid: true, expert: EXPERT }),
      });
    });

    await page.route('**/api/expert/settings/prompts/defaults', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          LUMIRA_DNA: 'Baseline DNA',
          SCRIBE: 'Baseline Scribe',
        }),
      });
    });

    await page.route('**/api/expert/settings/prompts', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          LUMIRA_DNA: { key: 'LUMIRA_DNA', value: 'Baseline DNA', version: 1, isCustom: false },
          SCRIBE: { key: 'SCRIBE', value: 'Baseline Scribe', version: 1, isCustom: false },
        }),
      });
    });

    await page.route('**/api/expert/settings/model-config', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          config: {
            providerMode: 'per_agent',
            agents: {
              SCRIBE: {
                enabled: true,
                provider: 'gemini',
                model: 'gemini-2.5-pro',
                maxOutputTokens: 8192,
              },
              EDITOR: {
                enabled: true,
                provider: 'gemini',
                model: 'gemini-2.5-flash',
                maxOutputTokens: 4096,
              },
              GUIDE: {
                enabled: true,
                provider: 'gemini',
                model: 'gemini-2.5-flash',
                maxOutputTokens: 4096,
              },
              NARRATOR: {
                enabled: true,
                provider: 'gemini',
                model: 'gemini-2.5-flash',
                maxOutputTokens: 4096,
              },
              CONFIDANT: {
                enabled: true,
                provider: 'gemini',
                model: 'gemini-2.5-flash',
                maxOutputTokens: 4096,
              },
              ONIRIQUE: {
                enabled: true,
                provider: 'gemini',
                model: 'gemini-2.5-flash',
                maxOutputTokens: 4096,
              },
            },
          },
          meta: { isCustom: false, version: 1, hasRestorableCustom: false },
        }),
      });
    });

    await page.route('**/api/expert/settings/status', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          openai: {
            envVar: 'OPENAI_API_KEY',
            configured: true,
            state: 'ok',
            model: 'gpt-4o',
            text: 'ok',
          },
          gemini: {
            envVar: 'GEMINI_API_KEY',
            configured: true,
            state: 'ok',
            model: 'gemini-2.5-pro',
            text: 'ok',
          },
          vertex: {
            envVar: 'GOOGLE_APPLICATION_CREDENTIALS',
            configured: false,
            state: 'not_configured',
            model: '',
            text: 'not_tested',
          },
        }),
      });
    });

    await page.route('**/api/expert/settings/readiness', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ready: true,
          verdict: 'GO',
          generatedAt: '2026-07-27T12:00:00.000Z',
          summary: { failures: 0, warnings: 1, passes: 5 },
          checks: [
            {
              id: 'model_config',
              label: 'Configuration des modèles IA',
              level: 'pass',
              detail: 'Tous les agents ont un modèle valide.',
            },
            {
              id: 'credentials',
              label: 'Clés et identifiants',
              level: 'warning',
              detail: 'Vertex non configuré.',
            },
          ],
          effectiveConfig: { providerMode: 'per_agent', agents: {} },
          activePromptVersions: [],
          recentRuns: [],
          recentRunSummary: {
            count: 42,
            successes: 40,
            errors: 2,
            estimatedCost: 0.1234,
          },
          // NOTE: activeRoutingRules is intentionally absent (retired field)
        }),
      });
    });

    await page.route('**/api/expert/settings/available-models**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          fetchedAt: '2026-07-27T12:00:00.000Z',
          openai: { configured: true, source: 'live', models: [] },
          gemini: { configured: true, source: 'live', models: [] },
          vertex: { configured: false, source: 'unavailable', models: [] },
        }),
      });
    });

    await page.goto('/admin/settings');

    // 1. Readiness verdict must be rendered
    await expect(page.getByText('GO', { exact: true })).toBeVisible();

    // 2. Readiness checks must be rendered
    await expect(page.getByText('Configuration des modèles IA')).toBeVisible();
    await expect(page.getByText('Tous les agents ont un modèle valide.')).toBeVisible();

    // 3. Telemetry must be rendered
    await expect(page.getByText('Télémétrie récente')).toBeVisible();
    await expect(page.getByText('42')).toBeVisible();
    await expect(page.getByText('$0.1234')).toBeVisible();

    // 4. Settings tabs must be rendered
    await expect(page.getByRole('button', { name: /Préproduction/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Connexion', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /ADN Lumira/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Prompts/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Modèles/i })).toBeVisible();

    // 5. Verify obsolete "Règles héritées" row is NOT displayed
    await expect(page.getByText('Règles héritées')).not.toBeVisible();
  });
});
