#!/usr/bin/env node

const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || 'https://oraclelumira.com').replace(
  /\/$/,
  '',
);
const DESK_BASE_URL = (process.env.DESK_BASE_URL || 'https://desk.oraclelumira.com').replace(
  /\/$/,
  '',
);
const EXPECTED_REVISION = process.env.EXPECTED_REVISION?.trim();
const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS || (EXPECTED_REVISION ? 36 : 1));
const RETRY_DELAY_MS = Number(process.env.RETRY_DELAY_SECONDS || 10) * 1000;
const PRIVATE_ROBOTS = ['noindex', 'nofollow', 'noarchive', 'nosnippet', 'noimageindex'];

function fail(message) {
  throw new Error(message);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchPage(name, url, options = {}) {
  let response;
  try {
    response = await fetch(url, { redirect: 'manual', ...options });
  } catch {
    fail(`${name} is unreachable`);
  }
  return { response, body: await response.text() };
}

function expectStatus(name, response, expected) {
  if (response.status !== expected)
    fail(`${name} returned ${response.status}, expected ${expected}`);
}

function expectPrivateHeaders(name, response) {
  const robots = response.headers.get('x-robots-tag') || '';
  const cacheControl = response.headers.get('cache-control') || '';
  if (!PRIVATE_ROBOTS.every((directive) => robots.includes(directive))) {
    fail(`${name} has incomplete X-Robots-Tag`);
  }
  if (!cacheControl.includes('private') || !cacheControl.includes('no-store')) {
    fail(`${name} is cacheable`);
  }
}

function getCanonical(body) {
  return body.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] || null;
}

function getMeta(body, property) {
  const matcher = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property.replace(':', '\\:')}["'][^>]+content=["']([^"']+)["']`,
    'i',
  );
  return body.match(matcher)?.[1] || null;
}

function expectPublicDocument(name, body, canonical) {
  if (getCanonical(body) !== canonical) fail(`${name} canonical is incorrect`);
  if ((body.match(/<h1\b/gi) || []).length !== 1) fail(`${name} must contain exactly one H1`);
  if (!/<title>[^<]*Oracle Lumira[^<]*<\/title>/i.test(body)) fail(`${name} title is missing`);
  const socialImage = getMeta(body, 'og:image');
  if (!socialImage || new URL(socialImage).origin !== new URL(PUBLIC_BASE_URL).origin) {
    fail(`${name} social image is missing or not absolute`);
  }
  return socialImage;
}

function sitemapLocations(body) {
  return [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

async function verifyRevision() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const { response, body } = await fetchPage('version', `${PUBLIC_BASE_URL}/api/version`);
    expectStatus('version', response, 200);
    expectPrivateHeaders('version', response);
    let value;
    try {
      value = JSON.parse(body);
    } catch {
      fail('version returned invalid JSON');
    }
    if (!value || typeof value.revision !== 'string' || value.service !== 'web') {
      fail('version response has an invalid contract');
    }
    if (!EXPECTED_REVISION) {
      process.stdout.write(`Deployed revision: ${value.revision}\n`);
      return;
    }
    if (value.revision === EXPECTED_REVISION) return;
    if (attempt === MAX_ATTEMPTS) fail('deployed revision does not match EXPECTED_REVISION');
    await sleep(RETRY_DELAY_MS);
  }
}

async function main() {
  await verifyRevision();

  const publicPaths = ['/', '/faq', '/notre-approche'];
  const socialImages = new Set();
  for (const pathname of publicPaths) {
    const { response, body } = await fetchPage(
      `public ${pathname}`,
      `${PUBLIC_BASE_URL}${pathname}`,
    );
    expectStatus(`public ${pathname}`, response, 200);
    socialImages.add(
      expectPublicDocument(`public ${pathname}`, body, `${PUBLIC_BASE_URL}${pathname}`),
    );
  }

  for (const socialImage of socialImages) {
    const { response } = await fetchPage('social image', socialImage);
    expectStatus('social image', response, 200);
    if (!/^image\//i.test(response.headers.get('content-type') || '')) {
      fail('social image content type is invalid');
    }
  }

  for (const pathname of ['/mentions-legales', '/confidentialite', '/cgv']) {
    const { response } = await fetchPage(`legal ${pathname}`, `${PUBLIC_BASE_URL}${pathname}`);
    expectStatus(`legal ${pathname}`, response, 200);
  }

  const { response: robots, body: robotsBody } = await fetchPage(
    'robots',
    `${PUBLIC_BASE_URL}/robots.txt`,
  );
  expectStatus('robots', robots, 200);
  if (!/^text\/plain/i.test(robots.headers.get('content-type') || ''))
    fail('robots content type is invalid');
  if (
    !robotsBody.includes(`Sitemap: ${PUBLIC_BASE_URL}/sitemap.xml`) ||
    !robotsBody.includes('Disallow: /api/')
  ) {
    fail('robots content is invalid');
  }

  const { response: sitemap, body: sitemapBody } = await fetchPage(
    'sitemap',
    `${PUBLIC_BASE_URL}/sitemap.xml`,
  );
  expectStatus('sitemap', sitemap, 200);
  const expectedLocations = [
    `${PUBLIC_BASE_URL}/`,
    `${PUBLIC_BASE_URL}/notre-approche`,
    `${PUBLIC_BASE_URL}/faq`,
  ];
  if (JSON.stringify(sitemapLocations(sitemapBody)) !== JSON.stringify(expectedLocations)) {
    fail('sitemap locations are invalid');
  }

  for (const pathname of [
    '/commande',
    '/payment-success',
    '/sanctuaire',
    '/sanctuaire/login',
    '/admin',
    '/admin/login',
    '/api/health',
  ]) {
    const { response, body } = await fetchPage(
      `private ${pathname}`,
      `${PUBLIC_BASE_URL}${pathname}`,
    );
    expectPrivateHeaders(`private ${pathname}`, response);
    if (getCanonical(body)) fail(`private ${pathname} exposes a canonical`);
  }

  for (const pathname of ['/', '/login', '/board', '/clients']) {
    const { response, body } = await fetchPage(`desk ${pathname}`, `${DESK_BASE_URL}${pathname}`);
    expectPrivateHeaders(`desk ${pathname}`, response);
    if (getCanonical(body) || /application\/ld\+json/i.test(body))
      fail(`desk ${pathname} exposes public SEO data`);
    if (/googletagmanager\.com|connect\.facebook\.net/i.test(body))
      fail(`desk ${pathname} embeds analytics`);
  }

  const { response: deskRobots, body: deskRobotsBody } = await fetchPage(
    'desk robots',
    `${DESK_BASE_URL}/robots.txt`,
  );
  expectStatus('desk robots', deskRobots, 200);
  expectPrivateHeaders('desk robots', deskRobots);
  if (deskRobotsBody !== 'User-agent: *\nDisallow: /\n') fail('desk robots content is invalid');

  const { response: deskSitemap } = await fetchPage('desk sitemap', `${DESK_BASE_URL}/sitemap.xml`);
  expectStatus('desk sitemap', deskSitemap, 404);
  expectPrivateHeaders('desk sitemap', deskSitemap);

  process.stdout.write('Production SEO, privacy, Desk, and revision checks passed.\n');
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
