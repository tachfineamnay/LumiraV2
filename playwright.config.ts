import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3110';
const webServerPort = new URL(baseURL).port || '3110';
const responsiveMatrixTest = 'apps/web/e2e/customer-responsive-matrix.spec.ts';

/**
 * Canonical browser matrix for Lumira's public customer journey.
 *
 * `tests/e2e` keeps the broader desktop and security regressions. `apps/web/e2e`
 * owns responsive product checks. The additional projects only run the focused
 * responsive contract so the complete local suite remains practical without CI.
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
    {
      name: 'narrow-chromium',
      use: {
        ...devices['Pixel 5'],
        browserName: 'chromium',
        viewport: { width: 320, height: 568 },
      },
      testMatch: responsiveMatrixTest,
    },
    {
      name: 'wide-mobile-webkit',
      use: {
        ...devices['iPhone 13'],
        browserName: 'webkit',
        viewport: { width: 430, height: 932 },
      },
      testMatch: responsiveMatrixTest,
    },
    {
      name: 'landscape-chromium',
      use: {
        ...devices['Pixel 5'],
        browserName: 'chromium',
        viewport: { width: 568, height: 320 },
      },
      testMatch: responsiveMatrixTest,
    },
    {
      name: 'landscape-webkit',
      use: {
        ...devices['iPhone 13'],
        browserName: 'webkit',
        viewport: { width: 568, height: 320 },
      },
      testMatch: responsiveMatrixTest,
    },
    {
      name: 'tablet-portrait-chromium',
      use: {
        ...devices['iPad (gen 7)'],
        browserName: 'chromium',
        viewport: { width: 768, height: 1024 },
      },
      testMatch: responsiveMatrixTest,
    },
    {
      name: 'tablet-portrait-webkit',
      use: {
        ...devices['iPad (gen 7)'],
        browserName: 'webkit',
        viewport: { width: 768, height: 1024 },
      },
      testMatch: responsiveMatrixTest,
    },
    {
      name: 'tablet-tall-chromium',
      use: {
        ...devices['iPad (gen 7)'],
        browserName: 'chromium',
        viewport: { width: 800, height: 1280 },
      },
      testMatch: responsiveMatrixTest,
    },
    {
      name: 'tablet-landscape-chromium',
      use: {
        ...devices['iPad (gen 7)'],
        browserName: 'chromium',
        viewport: { width: 1024, height: 768 },
      },
      testMatch: responsiveMatrixTest,
    },
    {
      name: 'desktop-compact-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 600 } },
      testMatch: responsiveMatrixTest,
    },
    {
      name: 'desktop-standard-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
      testMatch: responsiveMatrixTest,
    },
    {
      name: 'desktop-large-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
      testMatch: responsiveMatrixTest,
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
