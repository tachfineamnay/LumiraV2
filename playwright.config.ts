import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3110';
const webServerPort = new URL(baseURL).port || '3110';

/**
 * Canonical browser matrix for Lumira's public customer journey.
 *
 * `tests/e2e` keeps the broader desktop and security regressions. `apps/web/e2e`
 * owns responsive product checks. They run from this single configuration so a
 * production deploy cannot bypass Android Chromium or iPhone WebKit coverage.
 */
export default defineConfig({
  testDir: '.',
  testMatch: ['tests/e2e/**/*.spec.ts', 'apps/web/e2e/**/*.spec.ts'],
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : [['html'], ['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testIgnore: /tests\/e2e\/sanctuaire-mobile\.spec\.ts/,
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'] },
      testMatch: ['apps/web/e2e/**/*.spec.ts', 'tests/e2e/sanctuaire-mobile.spec.ts'],
    },
    {
      name: 'mobile-webkit',
      use: { ...devices['iPhone 13'], browserName: 'webkit' },
      testMatch: 'apps/web/e2e/**/*.spec.ts',
    },
  ],
  webServer: {
    command: 'node scripts/start-e2e-web.cjs',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PLAYWRIGHT_WEB_PORT: webServerPort,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_playwright',
    },
  },
});
