import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import { MetaPixel } from '../components/analytics/MetaPixel';

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

const SITE_URL = 'https://oraclelumira.com';
const SITE_TITLE = 'Oracle Lumira | Votre lecture d’âme personnalisée';
const SITE_DESCRIPTION =
  'Lecture personnalisée révisée par un expert : dossier sécurisé, PDF et audio privés, accès Sanctuaire 3 mois (early). Livraison sous 24 à 48h après scellement. 17€, paiement unique.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: '%s | Oracle Lumira',
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Oracle Lumira',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: '#040610',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`h-full ${inter.variable} ${playfair.variable}`}>
      <body className="font-sans h-full bg-void text-divine selection:bg-gold/30 antialiased">
        <MetaPixel />
        {children}
      </body>
    </html>
  );
}
