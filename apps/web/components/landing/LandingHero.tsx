import { ChevronDown } from 'lucide-react';
import { LandingAnchorLink } from './LandingAnchorLink';
import { SUBSCRIPTION } from '../../lib/products';

/**
 * Hero above the fold — fully server-rendered for LCP.
 * No framer-motion / filter blur (those delay paint until hydration).
 */
export function LandingHero() {
  return (
    <section className="relative z-10 flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-4 pb-16 pt-24 text-center selection:bg-cosmic-gold/20 md:pb-20 md:pt-32">
      <div
        className="pointer-events-none absolute inset-0 bg-noise opacity-30 mix-blend-overlay"
        aria-hidden
      />

      <div className="relative mx-auto flex w-full max-w-[1600px] flex-col items-center motion-safe:animate-hero-enter">
        <div className="mb-8 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 md:mb-12">
          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-cosmic-ethereal/60 md:text-xs md:tracking-[0.2em]">
            Lecture personnalisée · IA assistée · Révision humaine
          </p>
        </div>

        <div className="relative">
          <h1 className="select-none font-playfair text-[clamp(3rem,13vw,10rem)] italic leading-[0.85] tracking-[-0.05em]">
            <span className="block text-white/90 opacity-90 mix-blend-overlay">Oracle</span>
            <span className="-mt-1 block bg-gradient-to-b from-[#FFD700] to-white bg-clip-text text-transparent text-glow-hero md:-mt-6">
              Lumira
            </span>
          </h1>

          <div className="mx-auto mt-8 max-w-2xl px-2 md:mt-12">
            <p className="font-playfair text-2xl italic leading-relaxed text-white/90 md:text-3xl lg:text-4xl">
              Voir plus clair en soi.
            </p>
            <p className="mx-auto mt-4 max-w-xl text-sm font-light leading-relaxed tracking-wide text-white/65 md:text-lg lg:text-xl">
              Une lecture personnelle pour mettre des mots sur ce que vous traversez et regarder
              votre situation autrement.
            </p>
            <p className="mt-5 text-[11px] uppercase tracking-[0.15em] text-white/40 md:text-sm md:tracking-[0.2em]">
              Votre dossier · Préparation par IA · Validation par un expert
            </p>
          </div>
        </div>

        <div className="mt-10 flex w-full flex-col items-center gap-4 px-4 md:mt-16 md:gap-6">
          <LandingAnchorLink
            sectionId="niveaux"
            className="group pointer-events-auto relative w-full max-w-xs md:w-auto md:max-w-none"
          >
            <span className="absolute inset-0 scale-150 rounded-full bg-cosmic-gold/30 opacity-0 blur-[50px] transition-opacity duration-700 group-hover:opacity-70" />
            <span className="relative block w-full overflow-hidden rounded-full border border-white/10 bg-white/[0.02] px-8 py-4 text-center text-xs font-bold uppercase tracking-[0.2em] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.05)] transition-all duration-500 group-hover:border-cosmic-gold/50 group-hover:bg-white/[0.08] group-hover:shadow-[0_0_30px_rgba(255,215,0,0.2)] md:px-16 md:py-6 md:tracking-[0.25em]">
              <span className="relative z-10 transition-colors duration-500 group-hover:text-cosmic-gold">
                Découvrir ma lecture
              </span>
              <span className="absolute inset-x-0 bottom-0 h-px translate-y-full bg-gradient-to-r from-transparent via-cosmic-gold to-transparent opacity-50 transition-transform duration-500 group-hover:translate-y-0" />
            </span>
          </LandingAnchorLink>

          <div className="mt-4 flex items-center gap-5 opacity-60 md:mt-6 md:gap-8">
            <div className="flex flex-col items-center">
              <span className="font-playfair text-lg italic text-white md:text-xl">
                {SUBSCRIPTION.price}€
              </span>
              <span className="text-[9px] uppercase tracking-widest text-white/40 md:text-[10px]">
                paiement unique
              </span>
            </div>
            <div className="h-6 w-px bg-white/10 md:h-8" />
            <div className="flex flex-col items-center">
              <span className="font-playfair text-lg italic text-white md:text-xl">24–48h</span>
              <span className="text-[9px] uppercase tracking-widest text-white/40 md:text-[10px]">
                après scellement
              </span>
            </div>
            <div className="h-6 w-px bg-white/10 md:h-8" />
            <div className="flex flex-col items-center">
              <span className="font-playfair text-lg italic text-white md:text-xl">
                {SUBSCRIPTION.accessDurationMonths} mois
              </span>
              <span className="text-[9px] uppercase tracking-widest text-white/40 md:text-[10px]">
                Sanctuaire
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-white/20">
        <span className="text-[9px] uppercase tracking-[0.3em]">Découvrir</span>
        <ChevronDown className="h-4 w-4 motion-safe:animate-bounce" aria-hidden />
      </div>
    </section>
  );
}
