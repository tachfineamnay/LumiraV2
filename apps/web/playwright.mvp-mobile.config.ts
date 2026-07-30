import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
const webServerPort = new URL(baseURL).port || '3000';

export default defineConfig({
  testDir: './e2e',
  testMatch: [
    '**/checkout-mobile.spec.ts',
    '**/sanctuaire-mobile-journey.spec.ts',
    '**/mvp-mobile.spec.ts',
    '**/desk-mobile.spec.ts',
  ],
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  expect: {
    timeout: 20_000,
  },
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer: {
    command: `pnpm exec next dev -p ${webServerPort}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_playwright',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-webkit',
      use: { ...devices['iPhone 13'], browserName: 'webkit' },
    },
  ],
});
