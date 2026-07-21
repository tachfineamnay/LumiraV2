import { Header } from '../components/landing/Header';
import { Footer } from '../components/landing/Footer';
import { LandingHero } from '../components/landing/LandingHero';
import { LandingPricing } from '../components/landing/LandingPricing';
import { HowItWorks } from '../components/landing/HowItWorks';
import { WhatYouGet } from '../components/landing/WhatYouGet';
import { BeforeAfterSection } from '../components/landing/BeforeAfterSection';
import { TestimonialsCarousel } from '../components/landing/TestimonialsCarousel';
import { FinalCTA } from '../components/landing/FinalCTA';
import { Mandala } from '../components/ui/Mandala';

export default function Home() {
  return (
    <main className="relative bg-cosmic-void min-h-screen overflow-x-hidden starfield">
      <Header />

      <div
        className="fixed inset-0 flex items-center justify-center z-0 pointer-events-none"
        aria-hidden
      >
        <Mandala />
      </div>

      <LandingHero />

      <section className="relative py-24 z-10 content-visibility-auto">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="font-playfair italic text-3xl md:text-5xl text-white/80 leading-relaxed max-w-3xl mx-auto">
            &ldquo;Lumira, c&apos;est comme si quelqu&apos;un avait lu en vous —
            <span className="text-amber-300/90"> et avait osé vous dire la vérité.&rdquo;</span>
          </h2>
          <div className="mt-8 flex items-center justify-center gap-4 text-white/30 text-xs uppercase tracking-widest">
            <div className="w-12 h-px bg-white/10" />
            <span>Retour de nos premiers utilisateurs</span>
            <div className="w-12 h-px bg-white/10" />
          </div>
        </div>
      </section>

      <HowItWorks />
      <WhatYouGet />
      <LandingPricing />
      <BeforeAfterSection />
      <TestimonialsCarousel />
      <FinalCTA />
      <Footer />
    </main>
  );
}
