import { expect, test } from '@playwright/test';

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

const privatePaths = [
  '/commande',
  '/payment-success',
  '/sanctuaire',
  '/sanctuaire/login',
  '/admin',
  '/admin/login',
  '/api/health',
  '/api/version',
] as const;

function expectPrivateHeaders(headers: Record<string, string>) {
  expect(headers['x-robots-tag'] || '').toContain('noindex');
  expect(headers['x-robots-tag'] || '').toContain('nofollow');
  expect(headers['x-robots-tag'] || '').toContain('noimageindex');
  expect(headers['cache-control'] || '').toMatch(/private.*no-store|no-store.*private/i);
}

test.describe('SEO production search contract', () => {
  test.describe.configure({ timeout: 120_000 });

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
      if (document.getElementsByTagName('parsererror').length > 0) {
        throw new Error('Sitemap XML is not parseable');
      }
      return Array.from(document.getElementsByTagName('loc'), (node) => node.textContent);
    }, sitemapText);

    expect(locations).toEqual(publicPages.map(({ canonical }) => canonical));
    for (const location of locations) {
      expect(location).not.toMatch(
        /(?:admin|api|commande|payment-success|sanctuaire|desk|\?|www\.)/i,
      );
    }
  });

  test('public pages have canonical, indexable, branded metadata and one H1', async ({ page }) => {
    const seenDescriptions = new Set<string>();

    for (const entry of publicPages) {
      await page.goto(entry.path, { waitUntil: 'domcontentloaded' });
      const description = await page.locator('meta[name="description"]').getAttribute('content');
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      const robots = await page.locator('meta[name="robots"]').getAttribute('content');

      await expect(page).toHaveTitle(entry.title);
      expect(description).toBeTruthy();
      expect(canonical).toBeTruthy();
      expect(new URL(canonical!).toString()).toBe(entry.canonical);
      expect(robots || '').toContain('index');
      await expect(page.locator('h1')).toHaveCount(1);
      expect(seenDescriptions.has(description!)).toBe(false);
      seenDescriptions.add(description!);
    }
  });

  test('structured data is valid JSON and matches the offer source of truth', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const graph = await page
      .locator('script[type="application/ld+json"]')
      .evaluate((node) => JSON.parse(node.textContent || '{}'));
    const service = graph['@graph'].find(
      (entry: { '@type': string }) => entry['@type'] === 'Service',
    );

    expect(service).toBeTruthy();
    expect(service.offers).toMatchObject({
      price: '17',
      priceCurrency: 'EUR',
      url: 'https://oraclelumira.com/commande',
    });
    expect(JSON.stringify(graph)).not.toMatch(/AggregateRating|Review|4\.9|2 500/i);
  });

  test('private and transactional paths have noindex and no-store headers without a public canonical', async ({
    request,
  }) => {
    for (const path of privatePaths) {
      const response = await request.get(path, { maxRedirects: 0 });
      expectPrivateHeaders(response.headers());
      expect(await response.text()).not.toMatch(/<link[^>]+rel="canonical"/i);
    }
  });

  test('the Desk host is internal-only, non-cacheable and excluded from sitemap', async ({
    request,
  }) => {
    const deskHeaders = { Host: 'desk.localhost:3112' };
    for (const path of ['/', '/login', '/board', '/clients']) {
      const response = await request.get(path, { headers: deskHeaders, maxRedirects: 0 });
      expectPrivateHeaders(response.headers());
      const html = await response.text();
      expect(html).not.toMatch(/<link[^>]+rel="canonical"/i);
      expect(html).not.toContain('application/ld+json');
    }

    const robots = await request.get('/robots.txt', { headers: deskHeaders });
    await expect(robots).toBeOK();
    expectPrivateHeaders(robots.headers());
    expect(await robots.text()).toBe('User-agent: *\nDisallow: /\n');

    const sitemap = await request.get('/sitemap.xml', { headers: deskHeaders });
    expect(sitemap.status()).toBe(404);
    expectPrivateHeaders(sitemap.headers());
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
      {
        maxRedirects: 0,
      },
    );
    expect(payment.url()).toContain('payment_intent=pi_test');
    expect(payment.url()).toContain('session_id=cs_test');

    const www = await request.get('/faq?utm_campaign=launch', {
      headers: { Host: 'www.oraclelumira.com' },
      maxRedirects: 0,
    });
    expect(www.status()).toBe(308);
    const wwwLocation = new URL(www.headers().location || '');
    expect(wwwLocation.hostname).toBe('oraclelumira.com');
    expect(wwwLocation.search).toBe('?utm_campaign=launch');

    const upperCase = await request.get('/FAQ?fbclid=tracking', { maxRedirects: 0 });
    expect(upperCase.status()).toBe(308);
    const upperCaseLocation = new URL(upperCase.headers().location || '', page.url());
    expect(upperCaseLocation.pathname).toBe('/faq');
    expect(upperCaseLocation.search).toBe('?fbclid=tracking');
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
