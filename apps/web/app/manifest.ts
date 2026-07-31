import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Oracle Lumira',
    short_name: 'Lumira',
    description: 'Lecture personnalisée interprétative révisée par un expert.',
    start_url: '/',
    display: 'standalone',
    background_color: '#040610',
    theme_color: '#040610',
    lang: 'fr',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
