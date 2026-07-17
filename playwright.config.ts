import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // The standalone server is intentionally shared by BFF-mocked scenarios.
  // One worker prevents local resource contention and matches CI behavior.
  workers: 1,
  reporter: [['html'], ['list']],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /sanctuaire-mobile\.spec\.ts/,
    },
    {
      // Chromium + mobile viewport (WebKit not required on Windows CI/dev)
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      testMatch: /sanctuaire-mobile\.spec\.ts/,
    },
  ],

  webServer: {
    command: 'node scripts/start-e2e-web.cjs',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
