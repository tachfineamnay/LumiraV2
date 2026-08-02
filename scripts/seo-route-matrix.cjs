#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '..');
const appRoot = path.join(repositoryRoot, 'apps', 'web', 'app');
const indexablePaths = new Set(['/', '/notre-approche', '/faq']);
const publicNoindexPaths = new Set([
  '/mentions-legales',
  '/confidentialite',
  '/cgv',
  '/commande',
  '/payment-success',
  '/sanctuaire/login',
  '/robots.txt',
  '/sitemap.xml',
  '/opengraph-image',
]);

const metadataRouteFiles = {
  'robots.ts': 'robots.txt',
  'sitemap.ts': 'sitemap.xml',
  'opengraph-image.tsx': 'opengraph-image',
  'twitter-image.tsx': 'twitter-image',
  'favicon.ico': 'favicon.ico',
  'icon.tsx': 'icon',
};

function routeSegment(segment) {
  if (segment.startsWith('(') && segment.endsWith(')')) return null;
  if (segment.startsWith('@')) return null;
  if (segment.startsWith('[[...') && segment.endsWith(']]')) return `:${segment.slice(5, -2)}*`;
  if (segment.startsWith('[...') && segment.endsWith(']')) return `:${segment.slice(4, -1)}*`;
  if (segment.startsWith('[') && segment.endsWith(']')) return `:${segment.slice(1, -1)}`;
  return segment;
}

function discoverRoutes(directory, segments = [], routes = []) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const hasPage = entries.some((entry) => entry.isFile() && entry.name === 'page.tsx');
  const hasRoute = entries.some((entry) => entry.isFile() && entry.name === 'route.ts');
  const pathname = segments.length ? `/${segments.join('/')}` : '/';

  if (hasPage) routes.push({ path: pathname, kind: 'page' });
  if (hasRoute) routes.push({ path: pathname, kind: 'route' });
  for (const entry of entries) {
    if (!entry.isFile() || !(entry.name in metadataRouteFiles)) continue;
    const filenamePath = metadataRouteFiles[entry.name];
    routes.push({
      path: pathname === '/' ? `/${filenamePath}` : `${pathname}/${filenamePath}`,
      kind: 'metadata',
    });
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const segment = routeSegment(entry.name);
    discoverRoutes(
      path.join(directory, entry.name),
      segment ? [...segments, segment] : segments,
      routes,
    );
  }

  return routes;
}

function classify(route) {
  if (route.path === '/api' || route.path.startsWith('/api/')) return 'technical';
  if (indexablePaths.has(route.path)) return 'indexable';
  if (publicNoindexPaths.has(route.path)) return 'public-noindex';
  if (route.path === '/admin' || route.path.startsWith('/admin/')) return 'private';
  if (route.path === '/sanctuaire' || route.path.startsWith('/sanctuaire/')) return 'private';
  return 'unclassified';
}

function matrix() {
  const unique = new Map();
  for (const route of discoverRoutes(appRoot)) {
    unique.set(`${route.kind}:${route.path}`, route);
  }

  const entries = [...unique.values()]
    .map((route) => ({ ...route, classification: classify(route) }))
    .sort(
      (left, right) => left.path.localeCompare(right.path) || left.kind.localeCompare(right.kind),
    );
  const actualIndexable = entries
    .filter((entry) => entry.classification === 'indexable')
    .map((entry) => entry.path)
    .sort();
  const expectedIndexable = [...indexablePaths].sort();
  const unclassified = entries.filter((entry) => entry.classification === 'unclassified');

  if (JSON.stringify(actualIndexable) !== JSON.stringify(expectedIndexable)) {
    throw new Error(`Indexable routes mismatch: ${actualIndexable.join(', ') || '(none)'}`);
  }
  if (unclassified.length) {
    throw new Error(
      `Unclassified app routes: ${unclassified.map((entry) => entry.path).join(', ')}`,
    );
  }

  return entries;
}

try {
  const entries = matrix();
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(entries)}\n`);
  } else {
    process.stdout.write('classification\tkind\tpath\n');
    for (const entry of entries) {
      process.stdout.write(`${entry.classification}\t${entry.kind}\t${entry.path}\n`);
    }
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
