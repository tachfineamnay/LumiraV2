import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: [
    '**/checkout-mobile.spec.ts',
    '**/sanctuaire-mobile-journey.spec.ts',
    '**/mvp-mobile.spec.ts',
  ],
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
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
