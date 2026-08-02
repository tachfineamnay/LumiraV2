#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const localEnvironment = {
  ...process.env,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3100',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_seo_contract',
  NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID || 'G-SEO-CHECK',
  NEXT_PUBLIC_META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID || '123456789012345',
  APP_REVISION: process.env.APP_REVISION || `local-${new Date().toISOString().slice(0, 10)}`,
  LUMIRA_DISABLE_WEBPACK_CACHE: 'true',
};

function run(command, args, cwd = process.cwd()) {
  const result = spawnSync(command, args, {
    cwd,
    env: localEnvironment,
    shell: process.platform === 'win32' && command === 'pnpm',
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(
  process.execPath,
  ['../../node_modules/next/dist/bin/next', 'build'],
  path.join(process.cwd(), 'apps', 'web'),
);
run(process.execPath, ['scripts/seo-route-matrix.cjs']);
run('pnpm', ['seo:check:built']);
