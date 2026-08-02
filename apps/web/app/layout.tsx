import type { Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { ConsentManager } from '../components/analytics/ConsentManager';
import { rootMetadata } from '../lib/seo';

const inter = localFont({
  src: './fonts/inter-latin.woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--font-inter',
  preload: true,
  fallback: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
});

const playfair = localFont({
  src: [
    { path: './fonts/playfair-display-latin.woff2', weight: '400 900', style: 'normal' },
    { path: './fonts/playfair-display-latin-italic.woff2', weight: '400 900', style: 'italic' },
  ],
  display: 'swap',
  variable: '--font-playfair',
  preload: true,
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});

export const metadata = rootMetadata;

export const viewport: Viewport = {
  themeColor: '#040610',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`h-full ${inter.variable} ${playfair.variable}`}>
      <body className="font-sans h-full bg-void text-divine selection:bg-gold/30 antialiased">
        <ConsentManager />
        {children}
      </body>
    </html>
  );
}
