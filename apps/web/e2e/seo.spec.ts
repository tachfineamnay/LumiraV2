import { expect, test } from '@playwright/test';

const publicPages = ['/', '/notre-approche', '/faq'] as const;

test.describe('SEO public contract', () => {
  test.describe.configure({ timeout: 120_000 });
  test('robots and sitemap expose only the canonical public surface', async ({ request }) => {
    const [robots, sitemap] = await Promise.all([
      request.get('/robots.txt'),
      request.get('/sitemap.xml'),
    ]);
    await expect(robots).toBeOK();
    await expect(sitemap).toBeOK();

    const robotsText = await robots.text();
    const sitemapText = await sitemap.text();
    expect(robotsText).toContain('Sitemap: https://oraclelumira.com/sitemap.xml');
    expect(robotsText).toContain('Disallow: /sanctuaire/');
    expect(sitemapText).toContain('<loc>https://oraclelumira.com/</loc>');
    expect(sitemapText).toContain('<loc>https://oraclelumira.com/notre-approche</loc>');
    expect(sitemapText).toContain('<loc>https://oraclelumira.com/faq</loc>');
    for (const privatePath of [
      '/api/',
      '/admin/',
      '/commande',
      '/payment-success',
      '/sanctuaire/',
    ]) {
      expect(sitemapText).not.toContain(privatePath);
    }
  });

  test('indexable pages have unique server metadata, a canonical URL and an H1', async ({
    page,
  }) => {
    const seenTitles = new Set<string>();
    const seenDescriptions = new Set<string>();

    for (const path of publicPages) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const title = await page.title();
      const description = await page.locator('meta[name="description"]').getAttribute('content');
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      const robots = await page.locator('meta[name="robots"]').getAttribute('content');

      expect(title).not.toEqual('');
      expect(description).toBeTruthy();
      expect(canonical).toBe(`https://oraclelumira.com${path === '/' ? '' : path}`);
      expect(robots ?? '').not.toContain('noindex');
      await expect(page.locator('h1')).toHaveCount(1);
      expect(seenTitles.has(title)).toBe(false);
      expect(seenDescriptions.has(description!)).toBe(false);
      seenTitles.add(title);
      seenDescriptions.add(description!);
    }
  });

  test('structured data matches the commercial source of truth', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const graph = await page
      .locator('script[type="application/ld+json"]')
      .evaluate((node) => JSON.parse(node.textContent || '{}'));
    const service = graph['@graph'].find(
      (entry: { '@type': string }) => entry['@type'] === 'Service',
    );
    expect(service).toBeTruthy();
    expect(service.offers.price).toBe('17');
    expect(service.offers.priceCurrency).toBe('EUR');
    expect(service.offers.url).toBe('https://oraclelumira.com/commande');
  });

  test('private and transactional routes emit noindex and private cache headers', async ({
    request,
  }) => {
    for (const path of [
      '/commande',
      '/payment-success',
      '/sanctuaire/login',
      '/admin/login',
      '/api/health',
    ]) {
      const response = await request.get(path);
      expect(response.headers()['x-robots-tag']).toContain('noindex');
      const cacheControl = response.headers()['cache-control'] || '';
      expect(cacheControl).not.toContain('public');
      expect(cacheControl).toMatch(/private|no-store/);
    }
  });

  test('public pages stay within the initial JavaScript transfer budget', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const scriptBytes = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .filter((entry) => entry.name.includes('/_next/static/') && entry.name.endsWith('.js'))
        .reduce((total, entry) => total + (entry as PerformanceResourceTiming).transferSize, 0),
    );
    expect(scriptBytes).toBeLessThanOrEqual(1_500_000);
  });
});
