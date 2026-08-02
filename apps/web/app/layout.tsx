import type { Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import { ConsentBanner } from '../components/analytics/ConsentBanner';
import { ConsentProvider } from '../components/analytics/ConsentProvider';
import { GoogleAnalytics } from '../components/analytics/GoogleAnalytics';
import { MetaPixel } from '../components/analytics/MetaPixel';
import { rootMetadata } from '../lib/seo';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  preload: true,
  fallback: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-playfair',
  style: ['normal', 'italic'],
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
        <ConsentProvider>
          <MetaPixel />
          <GoogleAnalytics />
          {children}
          <ConsentBanner />
        </ConsentProvider>
      </body>
    </html>
  );
}

