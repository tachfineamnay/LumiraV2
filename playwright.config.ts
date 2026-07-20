import { defineConfig, devices } from '@playwright/test';

const iPhone13 = devices['iPhone 13'];
const iPhone13Chromium = {
  userAgent: iPhone13.userAgent,
  viewport: iPhone13.viewport,
  screen: iPhone13.screen,
  deviceScaleFactor: iPhone13.deviceScaleFactor,
  isMobile: iPhone13.isMobile,
  hasTouch: iPhone13.hasTouch,
};

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
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testIgnore: /sanctuaire-mobile\.spec\.ts/,
    },
    {
      // Chromium + mobile viewport (WebKit not required on Windows CI/dev).
      // The sealed-intake journey is run here as an explicit mobile smoke test.
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      testMatch: /sanctuaire-(mobile|intake-draft)\.spec\.ts/,
    },
    {
      // Safari viewport and touch metrics without requiring WebKit on Windows CI/dev.
      name: 'iPhone 13 Chrome',
      use: iPhone13Chromium,
      testMatch: /sanctuaire-intake-draft\.spec\.ts/,
    },
  ],

  webServer: {
    command: 'node scripts/start-e2e-web.cjs',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
