import type { Metadata } from 'next';
import { Header } from '../components/landing/Header';
import { Footer } from '../components/landing/Footer';
import { LandingHero } from '../components/landing/LandingHero';
import { LandingPricing } from '../components/landing/LandingPricing';
import { HowItWorks } from '../components/landing/HowItWorks';
import { WhatYouGet } from '../components/landing/WhatYouGet';
import { BeforeAfterSection } from '../components/landing/BeforeAfterSection';
import { TestimonialsSection } from '../components/landing/TestimonialsSection';
import { FinalCTA } from '../components/landing/FinalCTA';
import { LandingHashHandler } from '../components/landing/LandingHashHandler';
import { Mandala } from '../components/ui/Mandala';
import { JsonLd } from '../components/seo/JsonLd';
import { pageMetadata } from '../lib/seo';
import { CONTACT_EMAIL, OFFER, SITE_NAME, absoluteUrl } from '../lib/site';

export const metadata: Metadata = pageMetadata({
  path: '/',
  title: 'Lecture personnalisée révisée par un expert',
  description:
    'Une lecture personnalisée interprétative, préparée avec l’IA puis révisée par un expert. PDF et audio privés, accès Sanctuaire 3 mois. 17 €, paiement unique.',
});

export default function Home() {
  return (
    <>
      <Header />
      <main className="relative min-h-screen overflow-x-hidden bg-cosmic-void starfield">
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'Organization',
                '@id': `${absoluteUrl('/')}#organization`,
                name: SITE_NAME,
                url: absoluteUrl('/'),
                email: CONTACT_EMAIL,
              },
              {
                '@type': 'WebSite',
                '@id': `${absoluteUrl('/')}#website`,
                name: SITE_NAME,
                url: absoluteUrl('/'),
                inLanguage: 'fr-FR',
                publisher: { '@id': `${absoluteUrl('/')}#organization` },
              },
              {
                '@type': 'WebPage',
                '@id': `${absoluteUrl('/')}#webpage`,
                url: absoluteUrl('/'),
                name: 'Lecture personnalisée révisée par un expert',
                inLanguage: 'fr-FR',
                isPartOf: { '@id': `${absoluteUrl('/')}#website` },
              },
              {
                '@type': 'Service',
                '@id': `${absoluteUrl('/')}#service`,
                name: OFFER.publicName,
                description:
                  'Lecture personnalisée interprétative préparée avec l’IA puis révisée par un expert humain, livrée dans un espace privé.',
                provider: { '@id': `${absoluteUrl('/')}#organization` },
                areaServed: 'FR',
                offers: {
                  '@type': 'Offer',
                  url: absoluteUrl('/commande'),
                  price: String(OFFER.priceEuros),
                  priceCurrency: OFFER.currencyCode,
                  availability: 'https://schema.org/InStock',
                  category: 'one_time_service',
                },
              },
            ],
          }}
        />
        <LandingHashHandler />

        <div
          className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center"
          aria-hidden
        >
          <Mandala />
        </div>

        <LandingHero />

        <section
          className="relative z-10 py-24 content-visibility-auto"
          aria-labelledby="landing-introduction"
        >
          <div className="mx-auto max-w-5xl px-6 text-center">
            <h2
              id="landing-introduction"
              className="mx-auto max-w-3xl font-playfair text-3xl italic leading-relaxed text-white/80 md:text-5xl"
            >
              Une lecture pour explorer vos repères personnels,
              <span className="text-amber-300/90"> sans promettre de vérité absolue.</span>
            </h2>
            <div className="mt-8 flex items-center justify-center gap-4 text-xs uppercase tracking-widest text-white/30">
              <div className="h-px w-12 bg-white/10" />
              <span>Approche interprétative et accompagnement personnel</span>
              <div className="h-px w-12 bg-white/10" />
            </div>
          </div>
        </section>

        <HowItWorks />
        <WhatYouGet />
        <LandingPricing />
        <BeforeAfterSection />
        <TestimonialsSection />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
