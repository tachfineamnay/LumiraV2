import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const git = process.platform === 'win32' ? 'git.exe' : 'git';
const env = {
  ...process.env,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_playwright',
};

const skipInstall = process.env.VERIFY_SKIP_INSTALL === '1';
const skipBrowserInstall = process.env.VERIFY_SKIP_BROWSER_INSTALL === '1';

function run(label, command, args) {
  process.stdout.write(`\n\n=== ${label} ===\n${command} ${args.join(' ')}\n\n`);
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    console.error(`\n${label} impossible à exécuter:`, result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`\nÉCHEC: ${label} (code ${result.status ?? 'inconnu'}).`);
    process.exit(result.status || 1);
  }
}

run('Branche courante', git, ['rev-parse', '--abbrev-ref', 'HEAD']);
run('SHA courant', git, ['rev-parse', 'HEAD']);
run('Contrôle des espaces et marqueurs de conflit', git, ['diff', '--check']);

if (!skipInstall) {
  run('Installation figée', pnpm, ['install', '--frozen-lockfile']);
}

run('Génération Prisma', pnpm, ['db:generate']);
run('Typecheck monorepo', pnpm, ['typecheck']);
run('Lint monorepo', pnpm, ['lint']);
run('Tests API', pnpm, ['--filter', 'api', 'test', '--', '--runInBand']);
run('Build production web', pnpm, ['--filter', 'web...', 'build']);

if (!skipBrowserInstall) {
  run('Installation navigateurs Playwright', pnpm, [
    'exec',
    'playwright',
    'install',
    'chromium',
    'webkit',
  ]);
}

run('Parcours Playwright complets', pnpm, ['test:e2e']);

console.log('\n\nVALIDATION LOCALE VERTE\n');
console.log('Le build et les tests ont été exécutés sans GitHub Actions.');
console.log('Passez ensuite à la checklist manuelle de docs/PRODUCTION_RELEASE_CHECKLIST.md.');
