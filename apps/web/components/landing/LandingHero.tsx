import { ChevronDown } from 'lucide-react';
import { LandingAnchorLink } from './LandingAnchorLink';

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
        <div className="mb-8 flex items-center gap-3 md:mb-12">
          <div className="flex -space-x-3" aria-hidden>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-7 w-7 rounded-full border border-white/20 bg-gradient-to-br from-white/10 to-white/5 md:h-8 md:w-8"
              />
            ))}
          </div>
          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-cosmic-ethereal/60 md:text-xs md:tracking-[0.2em]">
            2 500+ âmes éveillées · 4.9/5
          </p>
        </div>

        <div className="relative">
          <h1 className="select-none font-playfair text-[clamp(3rem,13vw,10rem)] italic leading-[0.85] tracking-[-0.05em]">
            <span className="block text-white/90 opacity-90 mix-blend-overlay">Oracle</span>
            <span className="-mt-1 block bg-gradient-to-b from-[#FFD700] to-white bg-clip-text text-transparent text-glow-hero md:-mt-6">
              Lumira
            </span>
          </h1>

          <div className="mx-auto mt-8 max-w-xl px-2 md:mt-12">
            <p className="text-base font-light leading-relaxed tracking-wide text-white/85 md:text-xl lg:text-2xl">
              Ce que les autres mettent des années à comprendre sur eux-mêmes —
            </p>
            <p className="mt-2 text-base font-light leading-relaxed tracking-wide text-cosmic-gold/90 md:text-xl lg:text-2xl">
              Lumira vous le révèle en 24 heures.
            </p>
            <p className="mt-4 text-[11px] uppercase tracking-[0.15em] text-white/40 md:mt-5 md:text-sm md:tracking-[0.2em]">
              Analyse vibratoire · Intelligence IA · Expert humain
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

          <div className="mt-4 flex items-center gap-5 opacity-50 md:mt-6 md:gap-8">
            <div className="flex flex-col items-center">
              <span className="font-playfair text-lg italic text-white md:text-xl">4.9</span>
              <span className="text-[9px] uppercase tracking-widest text-white/40 md:text-[10px]">
                Note
              </span>
            </div>
            <div className="h-6 w-px bg-white/10 md:h-8" />
            <div className="flex flex-col items-center">
              <span className="font-playfair text-lg italic text-white md:text-xl">24h</span>
              <span className="text-[9px] uppercase tracking-widest text-white/40 md:text-[10px]">
                Livraison
              </span>
            </div>
            <div className="h-6 w-px bg-white/10 md:h-8" />
            <div className="flex flex-col items-center">
              <span className="font-playfair text-lg italic text-white md:text-xl">17€</span>
              <span className="text-[9px] uppercase tracking-widest text-white/40 md:text-[10px]">
                early · 3 mois
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
