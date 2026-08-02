import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const repositoryRoot = path.resolve(__dirname, '../../..');

type RouteMatrixEntry = {
  path: string;
  kind: 'page' | 'route' | 'metadata';
  classification: 'indexable' | 'public-noindex' | 'private' | 'technical';
};

const routeMatrix: RouteMatrixEntry[] = JSON.parse(
  execFileSync(process.execPath, ['scripts/seo-route-matrix.cjs', '--json'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }),
);

const publicPages = [
  {
    path: '/',
    canonical: 'https://oraclelumira.com/',
    title: 'Lecture personnalisée révisée par un expert | Oracle Lumira',
  },
  {
    path: '/notre-approche',
    canonical: 'https://oraclelumira.com/notre-approche',
    title: 'Notre approche | Oracle Lumira',
  },
  {
    path: '/faq',
    canonical: 'https://oraclelumira.com/faq',
    title: 'Questions fréquentes | Oracle Lumira',
  },
] as const;

function expectPrivateHeaders(headers: Record<string, string>) {
  expect(headers['x-robots-tag'] || '').toContain('noindex');
  expect(headers['x-robots-tag'] || '').toContain('nofollow');
  expect(headers['x-robots-tag'] || '').toContain('noarchive');
  expect(headers['x-robots-tag'] || '').toContain('nosnippet');
  expect(headers['x-robots-tag'] || '').toContain('noimageindex');
  expect(headers['cache-control'] || '').toMatch(/private.*no-store|no-store.*private/i);
}

function materializeRoute(pathname: string) {
  return pathname.replace(/:[^/]+/g, 'seo-contract');
}

test.describe('SEO production search contract', () => {
  test.describe.configure({ timeout: 120_000 });

  test('derives and classifies every App Router page and route', () => {
    expect(
      routeMatrix
        .filter((entry) => entry.classification === 'indexable')
        .map((entry) => entry.path),
    ).toEqual(['/', '/faq', '/notre-approche']);
    expect(routeMatrix.every((entry) => entry.classification)).toBe(true);
  });

  test('robots and sitemap expose exactly the three canonical public URLs', async ({
    page,
    request,
  }) => {
    const [robots, sitemap] = await Promise.all([
      request.get('/robots.txt'),
      request.get('/sitemap.xml'),
    ]);
    await expect(robots).toBeOK();
    await expect(sitemap).toBeOK();
    expect(robots.headers()['content-type'] || '').toMatch(/^text\/plain/i);
    expect(sitemap.headers()['content-type'] || '').toMatch(/^(application|text)\/xml/i);

    const robotsText = await robots.text();
    const sitemapText = await sitemap.text();
    expect(robotsText).toContain('Sitemap: https://oraclelumira.com/sitemap.xml');
    expect(robotsText).toContain('Disallow: /api/');
    expect(robotsText).not.toContain('Disallow: /sanctuaire/');

    const locations = await page.evaluate((xml) => {
      const document = new DOMParser().parseFromString(xml, 'application/xml');
      if (document.getElementsByTagName('parsererror').length > 0)
        throw new Error('Sitemap XML is not parseable');
      return Array.from(document.getElementsByTagName('loc'), (node) => node.textContent);
    }, sitemapText);

    expect(locations).toEqual(publicPages.map(({ canonical }) => canonical));
    for (const location of locations) {
      expect(location).not.toMatch(
        /(?:admin|api|commande|payment-success|sanctuaire|desk|token|session|order|email|\?)/i,
      );
    }
  });

  test('public pages have canonical metadata, a social image and one H1', async ({
    page,
    request,
  }) => {
    const seenDescriptions = new Set<string>();

    for (const entry of publicPages) {
      await page.goto(entry.path, { waitUntil: 'domcontentloaded' });
      const description = await page.locator('meta[name="description"]').getAttribute('content');
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      const robots = await page.locator('meta[name="robots"]').getAttribute('content');
      const socialImage = await page.locator('meta[property="og:image"]').getAttribute('content');

      await expect(page).toHaveTitle(entry.title);
      expect(description).toBeTruthy();
      expect(new URL(canonical!).toString()).toBe(entry.canonical);
      expect(robots || '').toContain('index');
      await expect(page.locator('h1')).toHaveCount(1);
      expect(seenDescriptions.has(description!)).toBe(false);
      expect(socialImage).toMatch(/^https:\/\/oraclelumira\.com\//);
      const socialImagePath = new URL(socialImage!).pathname;
      const socialResponse = await request.get(socialImagePath);
      await expect(socialResponse).toBeOK();
      seenDescriptions.add(description!);
    }

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('Lecture personnalisée révisée par un expert');
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary_large_image',
    );
  });

  test('FAQ structured data exactly matches visible questions and answers', async ({ page }) => {
    await page.goto('/faq', { waitUntil: 'domcontentloaded' });
    const schemas = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((nodes) => nodes.map((node) => JSON.parse(node.textContent || '{}')));
    const faq = schemas.find((schema) => schema['@type'] === 'FAQPage');
    expect(faq).toBeTruthy();

    for (const item of faq.mainEntity) {
      await expect(page.locator('dt', { hasText: item.name })).toHaveCount(1);
      await expect(page.locator('dd', { hasText: item.acceptedAnswer.text })).toHaveCount(1);
    }
  });

  test('every discovered private or technical route is noindex and no-store', async ({
    request,
  }) => {
    const protectedRoutes = routeMatrix.filter(
      (entry) => entry.classification === 'private' || entry.classification === 'technical',
    );

    for (const entry of protectedRoutes) {
      const response = await request.get(materializeRoute(entry.path), { maxRedirects: 0 });
      expectPrivateHeaders(response.headers());
    }
  });

  test('the Desk host is internal-only, non-cacheable and excluded from sitemap', async ({
    request,
  }) => {
    const deskHeaders = { Host: 'desk.localhost:3112' };
    for (const route of ['/', '/login', '/board', '/clients']) {
      const response = await request.get(route, { headers: deskHeaders, maxRedirects: 0 });
      expectPrivateHeaders(response.headers());
      const html = await response.text();
      expect(html).not.toMatch(/<link[^>]+rel="canonical"/i);
      expect(html).not.toContain('application/ld+json');
      expect(html).not.toMatch(/googletagmanager\.com|connect\.facebook\.net/i);
    }

    const robots = await request.get('/robots.txt', { headers: deskHeaders });
    await expect(robots).toBeOK();
    expectPrivateHeaders(robots.headers());
    expect(await robots.text()).toBe('User-agent: *\nDisallow: /\n');

    const sitemap = await request.get('/sitemap.xml', { headers: deskHeaders });
    expect(sitemap.status()).toBe(404);
    expectPrivateHeaders(sitemap.headers());
  });

  test('analytics and marketing require consent and never render on private pages', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('dialog', { name: 'Préférences cookies' })).toBeVisible();
    await expect(page.locator('#google-analytics-loader')).toHaveCount(0);
    await expect(page.locator('#meta-pixel')).toHaveCount(0);

    await page.getByRole('button', { name: 'Tout refuser' }).click();
    await expect(page.locator('#google-analytics-loader')).toHaveCount(0);
    await expect(page.locator('#meta-pixel')).toHaveCount(0);

    await page.getByRole('button', { name: 'Préférences cookies' }).click();
    await page.getByRole('button', { name: 'Tout accepter' }).click();
    await expect(page.locator('#google-analytics-loader')).toHaveCount(1);
    await expect(page.locator('#meta-pixel')).toHaveCount(1);

    await page.goto('/sanctuaire/login', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#google-analytics-loader')).toHaveCount(0);
    await expect(page.locator('#meta-pixel')).toHaveCount(0);
  });

  test('canonical redirects preserve attribution and payment parameters', async ({
    page,
    request,
  }) => {
    const tracking = await request.get('/faq?utm_source=newsletter&gclid=abc&_ga=123', {
      maxRedirects: 0,
    });
    expect(tracking.url()).toContain('utm_source=newsletter');
    expect(tracking.url()).toContain('gclid=abc');

    await page.goto('/faq?utm_source=newsletter&gclid=abc', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/utm_source=newsletter.*gclid=abc/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://oraclelumira.com/faq',
    );

    const payment = await request.get(
      '/payment-success?payment_intent=pi_test&session_id=cs_test',
      { maxRedirects: 0 },
    );
    expect(payment.url()).toContain('payment_intent=pi_test');
    expect(payment.url()).toContain('session_id=cs_test');
  });

  test('the deployed revision endpoint is technical, private and non-cacheable', async ({
    request,
  }) => {
    const response = await request.get('/api/version');
    await expect(response).toBeOK();
    expectPrivateHeaders(response.headers());
    expect(await response.json()).toEqual(
      expect.objectContaining({ revision: expect.any(String), service: 'web' }),
    );
  });
});
