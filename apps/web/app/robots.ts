import type { MetadataRoute } from 'next';
import { absoluteUrl } from '../lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/commande', '/payment-success', '/sanctuaire/'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: 'oraclelumira.com',
  };
}
