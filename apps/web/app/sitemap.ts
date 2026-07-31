import type { MetadataRoute } from 'next';
import { INDEXABLE_PUBLIC_ROUTES, absoluteUrl, routeLastModified } from '../lib/site';

/**
 * Only routes registered in INDEXABLE_PUBLIC_ROUTES can enter the sitemap.
 * Future editorial collections should add their own generated sitemap rather
 * than appending private or parameterized URLs here.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return INDEXABLE_PUBLIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: routeLastModified(route.path),
    changeFrequency: route.path === '/' ? 'weekly' : 'monthly',
    priority: route.path === '/' ? 1 : 0.8,
  }));
}
