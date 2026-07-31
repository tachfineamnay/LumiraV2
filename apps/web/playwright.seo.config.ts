import { defineConfig, devices } from '@playwright/test';

const port = 3112;
const baseURL = `http://127.0.0.1:${port}`;

/** A self-contained public SEO check; it never relies on a developer server. */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/seo.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `pnpm exec next dev -p ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_seo_contract',
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
