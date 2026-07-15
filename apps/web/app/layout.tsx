import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { StripeProvider } from '../context/StripeProvider';

export const metadata: Metadata = {
  title: 'Oracle Lumira | Guidance Spirituelle',
  description:
    'Découvrez votre cartographie vibratoire et votre guidance spirituelle dans un sanctuaire de luxe.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="h-full">
      <body className="font-sans h-full bg-void text-divine selection:bg-gold/30 antialiased">
        <StripeProvider>
          <AuthProvider>{children}</AuthProvider>
        </StripeProvider>
      </body>
    </html>
  );
}
