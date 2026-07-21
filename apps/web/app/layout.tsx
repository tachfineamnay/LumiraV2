import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { StripeProvider } from '../context/StripeProvider';
import { MetaPixel } from '../components/analytics/MetaPixel';

const SITE_URL = 'https://oraclelumira.com';
const SITE_TITLE = 'Oracle Lumira | Votre lecture d’âme personnalisée';
const SITE_DESCRIPTION =
  'Lecture personnalisée par un expert : PDF, audio, mandala et guidance 30 jours. Livrée sous 24h dans votre sanctuaire privé. 29€, satisfait ou remboursé 14 jours.';

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="h-full">
      <body className="font-sans h-full bg-void text-divine selection:bg-gold/30 antialiased">
        <MetaPixel />
        <StripeProvider>
          <AuthProvider>{children}</AuthProvider>
        </StripeProvider>
      </body>
    </html>
  );
}
