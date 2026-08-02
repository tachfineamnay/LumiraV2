import { defineConfig, devices } from '@playwright/test';

const port = 3112;
const baseURL = `http://127.0.0.1:${port}`;

/** A self-contained production-build SEO check; it never relies on next dev. */
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
    command: 'node .next/standalone/apps/web/server.js',
    url: `${baseURL}/api/version`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_seo_contract',
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
